-- Recovery migration for ERR_RATING_SCORE_RANGE validation bug.
--
-- Root cause: upsert_match_peer_ratings was partially migrated on the cloud.
-- It's running the 20260516 version (validates 1–10 range) but should run 20260622 (0–100 range).
-- The UI sends band scores 45/60/75/90, causing all ratings to fail validation.
--
-- This migration:
-- 1. Ensures rating_window_ends_at column exists on matches
-- 2. Ensures aggregate tables exist (idempotent)
-- 3. Drops + recreates upsert_match_peer_ratings with 0–100 range + aggregate writes
-- 4. Ensures submit_match_ratings_bundle is correct
-- 5. Re-applies grants

-- ── Column prerequisite ──────────────────────────────────────────────────────

alter table public.matches
  add column if not exists rating_window_ends_at timestamptz;

-- ── Aggregate tables (idempotent) ────────────────────────────────────────────

create table if not exists public.match_player_rating_aggregates (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  score_total integer not null default 0,
  vote_count integer not null default 0,
  avg_score_100 numeric(5,2) generated always as (
    case when vote_count > 0 then (score_total::numeric / vote_count::numeric) else null end
  ) stored,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists match_player_rating_aggregates_player_idx
  on public.match_player_rating_aggregates (player_id);

drop trigger if exists match_player_rating_aggregates_set_updated_at on public.match_player_rating_aggregates;

create trigger match_player_rating_aggregates_set_updated_at
before update on public.match_player_rating_aggregates
for each row execute procedure public.set_updated_at();

create table if not exists public.player_rating_aggregates (
  player_id uuid primary key references public.profiles (id) on delete cascade,
  score_total integer not null default 0,
  vote_count integer not null default 0,
  avg_score_100 numeric(5,2) generated always as (
    case when vote_count > 0 then (score_total::numeric / vote_count::numeric) else null end
  ) stored,
  motm_count integer not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists player_rating_aggregates_set_updated_at on public.player_rating_aggregates;

create trigger player_rating_aggregates_set_updated_at
before update on public.player_rating_aggregates
for each row execute procedure public.set_updated_at();

create table if not exists public.match_rating_submissions (
  match_id uuid not null references public.matches (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (match_id, rater_id)
);

alter table public.match_rating_submissions enable row level security;

drop policy if exists match_rating_submissions_select_own on public.match_rating_submissions;

create policy match_rating_submissions_select_own on public.match_rating_submissions
for select to authenticated using (rater_id = auth.uid());

grant select on table public.match_rating_submissions to authenticated;
grant all on table public.match_player_rating_aggregates to service_role;
grant all on table public.player_rating_aggregates to service_role;

-- ── Drop + recreate upsert_match_peer_ratings with correct body ──────────────

drop function if exists public.upsert_match_peer_ratings(uuid, jsonb);

create function public.upsert_match_peer_ratings(p_match_id uuid, p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.match_status;
  win_ends timestamptz;
  elem jsonb;
  pid uuid;
  sc int;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    perform public.raise_app_error('ERR_RATING_CANNOT_PARTICIPATE');
  end if;

  select m.status, m.rating_window_ends_at
  into st, win_ends
  from public.matches m
  where m.id = p_match_id;

  if st is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if st <> 'finished'::public.match_status then
    perform public.raise_app_error('ERR_RATING_FINISHED_ONLY');
  end if;

  if win_ends is not null and now() > win_ends then
    perform public.raise_app_error('ERR_RATING_WINDOW_CLOSED');
  end if;

  if exists (
    select 1 from public.match_rating_submissions s
    where s.match_id = p_match_id and s.rater_id = uid
  ) then
    raise exception 'Bu maç için puanlamayı zaten gönderdiniz';
  end if;

  for elem in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    pid := (elem ->> 'ratee_id')::uuid;
    sc := (elem ->> 'score')::int;
    if pid is null or pid = uid then
      perform public.raise_app_error('ERR_RATING_INVALID_RATEE');
    end if;
    if sc is null or sc < 0 or sc > 100 then
      perform public.raise_app_error('ERR_RATING_SCORE_RANGE');
    end if;
    if not public.match_rating_ratee_is_eligible(p_match_id, pid) then
      perform public.raise_app_error('ERR_RATING_RATEE_INELIGIBLE');
    end if;
  end loop;

  insert into public.match_rating_submissions (match_id, rater_id)
  values (p_match_id, uid);

  for elem in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    pid := (elem ->> 'ratee_id')::uuid;
    sc := (elem ->> 'score')::int;

    insert into public.match_player_rating_aggregates (
      match_id,
      player_id,
      score_total,
      vote_count
    )
    values (p_match_id, pid, sc, 1)
    on conflict (match_id, player_id) do update
      set score_total = public.match_player_rating_aggregates.score_total + excluded.score_total,
          vote_count = public.match_player_rating_aggregates.vote_count + excluded.vote_count;

    insert into public.player_rating_aggregates (
      player_id,
      score_total,
      vote_count
    )
    values (pid, sc, 1)
    on conflict (player_id) do update
      set score_total = public.player_rating_aggregates.score_total + excluded.score_total,
          vote_count = public.player_rating_aggregates.vote_count + excluded.vote_count;
  end loop;
end;
$$;

revoke execute on function public.upsert_match_peer_ratings(uuid, jsonb) from public;
revoke execute on function public.upsert_match_peer_ratings(uuid, jsonb) from anon;
grant execute on function public.upsert_match_peer_ratings(uuid, jsonb) to authenticated;

-- ── Ensure submit_match_ratings_bundle is correct (CREATE OR REPLACE) ────────

create or replace function public.submit_match_ratings_bundle(
  p_match_id uuid,
  p_scores jsonb,
  p_motm_pick_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_match_peer_ratings(p_match_id, p_scores);
  perform public.upsert_match_motm_vote(p_match_id, p_motm_pick_player_id);
end;
$$;

revoke execute on function public.submit_match_ratings_bundle(uuid, jsonb, uuid) from public;
revoke execute on function public.submit_match_ratings_bundle(uuid, jsonb, uuid) from anon;
grant execute on function public.submit_match_ratings_bundle(uuid, jsonb, uuid) to authenticated;
