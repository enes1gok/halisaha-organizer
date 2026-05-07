-- Peer ratings (1–10) and man-of-the-match votes for finished matches.
-- Eligible cohort: players assigned in match_team_players only (on-field).

-- --- Tables ---

create table public.match_peer_ratings (
  match_id uuid not null references public.matches (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null,
  created_at timestamptz not null default now(),
  primary key (match_id, rater_id, ratee_id),
  constraint match_peer_ratings_no_self check (rater_id <> ratee_id),
  constraint match_peer_ratings_score_range check (score >= 1 and score <= 10)
);

create index match_peer_ratings_match_ratee_idx on public.match_peer_ratings (match_id, ratee_id);

create table public.match_motm_votes (
  match_id uuid not null references public.matches (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  pick_player_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_id),
  constraint match_motm_votes_no_self_pick check (voter_id <> pick_player_id)
);

create index match_motm_votes_match_pick_idx on public.match_motm_votes (match_id, pick_player_id);

-- --- Helpers (SECURITY DEFINER) ---

create or replace function public.match_rating_eligible_player_ids(p_match_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.player_id
  from public.match_team_players t
  where t.match_id = p_match_id;
$$;

create or replace function public.match_rating_rater_can_participate(p_match_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_view_match(p_match_id, p_uid)
    and exists (
      select 1
      from public.match_team_players t
      where t.match_id = p_match_id
        and t.player_id = p_uid
    );
$$;

create or replace function public.match_rating_ratee_is_eligible(p_match_id uuid, p_ratee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_team_players t
    where t.match_id = p_match_id
      and t.player_id = p_ratee
  );
$$;

-- --- RPC: replace all peer scores for current rater ---

create or replace function public.upsert_match_peer_ratings(p_match_id uuid, p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.match_status;
  elem jsonb;
  pid uuid;
  sc int;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    raise exception 'Bu maç için derecelendirme yapılamaz';
  end if;

  select m.status into st from public.matches m where m.id = p_match_id;
  if st is null then
    raise exception 'Maç bulunamadı';
  end if;
  if st <> 'finished'::public.match_status then
    raise exception 'Derecelendirme yalnızca bitmiş maçlarda yapılabilir';
  end if;

  for elem in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    pid := (elem ->> 'ratee_id')::uuid;
    sc := (elem ->> 'score')::int;
    if pid is null or pid = uid then
      raise exception 'Geçersiz oyuncu seçimi';
    end if;
    if sc is null or sc < 1 or sc > 10 then
      raise exception 'Puan 1 ile 10 arasında olmalı';
    end if;
    if not public.match_rating_ratee_is_eligible(p_match_id, pid) then
      raise exception 'Bu oyuncu bu maç için derecelendirilemez';
    end if;
  end loop;

  delete from public.match_peer_ratings r
  where r.match_id = p_match_id and r.rater_id = uid;

  for elem in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    pid := (elem ->> 'ratee_id')::uuid;
    sc := (elem ->> 'score')::int;
    insert into public.match_peer_ratings (match_id, rater_id, ratee_id, score)
    values (p_match_id, uid, pid, sc::smallint);
  end loop;
end;
$$;

-- --- RPC: MOTM vote (one per voter per match) ---

create or replace function public.upsert_match_motm_vote(p_match_id uuid, p_pick_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.match_status;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    raise exception 'Bu maç için oy kullanamazsınız';
  end if;

  if p_pick_player_id is null or p_pick_player_id = uid then
    raise exception 'Maçın adamı için geçerli bir oyuncu seçin';
  end if;

  select m.status into st from public.matches m where m.id = p_match_id;
  if st is null then
    raise exception 'Maç bulunamadı';
  end if;
  if st <> 'finished'::public.match_status then
    raise exception 'Oy yalnızca bitmiş maçlarda kullanılabilir';
  end if;

  if not public.match_rating_ratee_is_eligible(p_match_id, p_pick_player_id) then
    raise exception 'Seçilen oyuncu bu maçta yer almıyor';
  end if;

  insert into public.match_motm_votes (match_id, voter_id, pick_player_id)
  values (p_match_id, uid, p_pick_player_id)
  on conflict (match_id, voter_id) do update
  set pick_player_id = excluded.pick_player_id,
      created_at = now();
end;
$$;

-- --- RPC: public aggregates (no per-rater leakage) ---

create or replace function public.get_match_rating_public_summary(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with chk as (
    select 1 as ok
    where auth.uid() is not null
      and public.can_view_match(p_match_id, auth.uid())
  ),
  elig as (
    select t.player_id
    from public.match_team_players t
    where t.match_id = p_match_id
  ),
  peer_agg as (
    select r.ratee_id as player_id,
      round(avg(r.score::numeric), 1) as avg,
      count(*)::int as votes_count
    from public.match_peer_ratings r
    where r.match_id = p_match_id
    group by r.ratee_id
  ),
  players_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'player_id', e.player_id,
          'avg', pa.avg,
          'votes_count', coalesce(pa.votes_count, 0)
        )
        order by e.player_id
      ),
      '[]'::jsonb
    ) as players
    from elig e
    left join peer_agg pa on pa.player_id = e.player_id
  ),
  motm_rank as (
    select v.pick_player_id as player_id, count(*)::int as votes
    from public.match_motm_votes v
    where v.match_id = p_match_id
    group by v.pick_player_id
  ),
  motm_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('player_id', x.player_id, 'votes', x.votes)
        order by x.votes desc, x.player_id
      ),
      '[]'::jsonb
    ) as motm
    from motm_rank x
  )
  select case
      when exists (select 1 from chk) then jsonb_build_object('players', pj.players, 'motm', mj.motm)
      else null::jsonb
    end
  from players_json pj
  cross join motm_json mj;
$$;

-- --- RLS ---

alter table public.match_peer_ratings enable row level security;

alter table public.match_motm_votes enable row level security;

create policy match_peer_ratings_select_own on public.match_peer_ratings for
select to authenticated using (rater_id = auth.uid());

create policy match_motm_votes_select_own on public.match_motm_votes for
select to authenticated using (voter_id = auth.uid());

-- Writes only via SECURITY DEFINER RPCs (no insert/update/delete policies for authenticated)

-- --- Grants ---

grant select on table public.match_peer_ratings to authenticated;

grant select on table public.match_motm_votes to authenticated;

grant all on table public.match_peer_ratings to service_role;

grant all on table public.match_motm_votes to service_role;

grant execute on function public.match_rating_eligible_player_ids (uuid) to authenticated;

grant execute on function public.match_rating_rater_can_participate (uuid, uuid) to authenticated;

grant execute on function public.match_rating_ratee_is_eligible (uuid, uuid) to authenticated;

grant execute on function public.upsert_match_peer_ratings (uuid, jsonb) to authenticated;

grant execute on function public.upsert_match_motm_vote (uuid, uuid) to authenticated;

grant execute on function public.get_match_rating_public_summary (uuid) to authenticated;
