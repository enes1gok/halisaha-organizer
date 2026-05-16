-- Skor oylama: kadrodaki oyuncular ve organizatör maç bitişinde skor önerisi girebilir.
-- En çok oy ağırlığına sahip skor öneri olarak gösterilir; organizatör her zaman override edebilir.
-- Organizatörün oyu 2x ağırlık taşır (get_match_score_vote_tally fonksiyonunda hesaplanır).

-- ---------------------------------------------------------------------------
-- 1. Tablo
-- ---------------------------------------------------------------------------

create table public.match_score_votes (
  match_id     uuid not null references public.matches(id) on delete cascade,
  voter_id     uuid not null references public.profiles(id) on delete cascade,
  score_a      int  not null check (score_a >= 0),
  score_b      int  not null check (score_b >= 0),
  submitted_at timestamptz not null default now(),
  primary key (match_id, voter_id)
);

comment on table public.match_score_votes is
  'Post-maç skor önerileri; oyuncu başına bir satır (upsert ile güncellenebilir).';

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

alter table public.match_score_votes enable row level security;

-- Sadece kadrodaki oyuncular ve organizatör oy kullanabilir/görüntüleyebilir
create policy "match_score_votes_access" on public.match_score_votes
  for all to authenticated
  using (
    exists (
      select 1 from public.match_team_players mtp
      where mtp.match_id = match_score_votes.match_id
        and mtp.player_id = auth.uid()
    )
    or exists (
      select 1 from public.matches m
      where m.id = match_score_votes.match_id
        and m.organizer_id = auth.uid()
    )
  )
  with check (
    voter_id = auth.uid()
    and (
      exists (
        select 1 from public.match_team_players mtp
        where mtp.match_id = match_score_votes.match_id
          and mtp.player_id = auth.uid()
      )
      or exists (
        select 1 from public.matches m
        where m.id = match_score_votes.match_id
          and m.organizer_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Tally fonksiyonu (organizatör oyu 2x ağırlık)
-- ---------------------------------------------------------------------------

create or replace function public.get_match_score_vote_tally(p_match_id uuid)
returns table (score_a int, score_b int, vote_weight int, voter_count int)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.score_a,
    v.score_b,
    sum(case when m.organizer_id = v.voter_id then 2 else 1 end)::int as vote_weight,
    count(*)::int as voter_count
  from public.match_score_votes v
  join public.matches m on m.id = v.match_id
  where v.match_id = p_match_id
    and (
      exists (
        select 1 from public.match_team_players mtp
        where mtp.match_id = p_match_id and mtp.player_id = auth.uid()
      )
      or m.organizer_id = auth.uid()
    )
  group by v.score_a, v.score_b
  order by vote_weight desc;
$$;

revoke execute on function public.get_match_score_vote_tally(uuid) from public, anon;
grant execute on function public.get_match_score_vote_tally(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Upsert RPC
-- ---------------------------------------------------------------------------

create or replace function public.upsert_match_score_vote(
  p_match_id uuid,
  p_score_a  int,
  p_score_b  int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  match_rec public.matches;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  select * into match_rec
  from public.matches
  where id = p_match_id;

  if match_rec.id is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  -- Maç henüz bitmemiş ve 60 dakika geçmiş olmalı
  if match_rec.status <> 'upcoming'::public.match_status
    or match_rec.starts_at + interval '60 minutes' > now()
  then
    perform public.raise_app_error('ERR_SCORE_VOTE_NOT_ALLOWED');
  end if;

  -- Çağıran kişi kadro veya organizatör olmalı
  if not (
    exists (
      select 1 from public.match_team_players mtp
      where mtp.match_id = p_match_id and mtp.player_id = uid
    )
    or match_rec.organizer_id = uid
  ) then
    perform public.raise_app_error('ERR_SCORE_VOTE_NOT_ALLOWED');
  end if;

  insert into public.match_score_votes (match_id, voter_id, score_a, score_b, submitted_at)
  values (p_match_id, uid, p_score_a, p_score_b, now())
  on conflict (match_id, voter_id) do update
    set score_a      = excluded.score_a,
        score_b      = excluded.score_b,
        submitted_at = excluded.submitted_at;
end;
$$;

revoke execute on function public.upsert_match_score_vote(uuid, int, int) from public, anon;
grant execute on function public.upsert_match_score_vote(uuid, int, int) to authenticated;
