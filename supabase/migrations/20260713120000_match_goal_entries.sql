-- Migration: Per-Player Goal Entries
--
-- Allows each lineup player to save their own goals/assists before the organizer
-- finalizes the match result. Entries are visible to all match participants.
--
-- Changes:
--   1. match_goal_entries table — per-player draft goal/assist counts.
--   2. RLS policies — lineup players write own row; all authenticated viewers read.
--   3. upsert_match_goal_entry RPC — players save their own entry.
--   4. get_match_goal_entries RPC — returns all entries for a match.
--   5. ERR_INVALID_GOAL_COUNT error token registered.

-- ── 1. Table ──────────────────────────────────────────────────────────────────

create table if not exists public.match_goal_entries (
  match_id   uuid not null references public.matches(id)   on delete cascade on update cascade,
  player_id  uuid not null references public.profiles(id)  on delete cascade on update cascade,
  goals      int  not null default 0 check (goals >= 0),
  assists    int  not null default 0 check (assists >= 0),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create trigger match_goal_entries_set_updated_at
  before update on public.match_goal_entries
  for each row execute procedure public.set_updated_at();

-- ── 2. RLS ────────────────────────────────────────────────────────────────────

alter table public.match_goal_entries enable row level security;

-- Authenticated users who can view the match may read all entries.
create policy "match_goal_entries_select"
  on public.match_goal_entries
  for select
  to authenticated
  using (public.can_view_match(match_id, auth.uid()));

-- A lineup player can insert/update only their own row.
create policy "match_goal_entries_insert"
  on public.match_goal_entries
  for insert
  to authenticated
  with check (
    player_id = auth.uid()
    and public.match_rating_rater_can_participate(match_id, auth.uid())
  );

create policy "match_goal_entries_update"
  on public.match_goal_entries
  for update
  to authenticated
  using (
    player_id = auth.uid()
    and public.match_rating_rater_can_participate(match_id, auth.uid())
  )
  with check (player_id = auth.uid());

-- ── 3. ERR token registration ─────────────────────────────────────────────────
-- Matches the raise_app_error_protocol pattern: token is checked by mapSupabaseError
-- on the client via ERR_REGISTRY.

comment on table public.match_goal_entries is
  'ERR_REGISTRY: ERR_INVALID_GOAL_COUNT — p_goals or p_assists is negative';

-- ── 4. upsert_match_goal_entry ────────────────────────────────────────────────

create function public.upsert_match_goal_entry(
  p_match_id  uuid,
  p_goals     int default 0,
  p_assists   int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  v_starts_at timestamptz;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    perform public.raise_app_error('ERR_RATING_CANNOT_PARTICIPATE');
  end if;

  select m.starts_at into v_starts_at
  from public.matches m
  where m.id = p_match_id;

  if v_starts_at is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if now() < v_starts_at + interval '60 minutes' then
    perform public.raise_app_error('ERR_MATCH_SCORE_BEFORE_END');
  end if;

  if p_goals < 0 or p_assists < 0 then
    perform public.raise_app_error('ERR_INVALID_GOAL_COUNT');
  end if;

  insert into public.match_goal_entries (match_id, player_id, goals, assists)
  values (p_match_id, uid, p_goals, p_assists)
  on conflict (match_id, player_id) do update
    set goals     = excluded.goals,
        assists   = excluded.assists,
        updated_at = now();
end;
$$;

revoke execute on function public.upsert_match_goal_entry(uuid, int, int) from public;
revoke execute on function public.upsert_match_goal_entry(uuid, int, int) from anon;
grant execute on function public.upsert_match_goal_entry(uuid, int, int) to authenticated;

-- ── 5. get_match_goal_entries ─────────────────────────────────────────────────

create function public.get_match_goal_entries(p_match_id uuid)
returns table (player_id uuid, goals int, assists int)
language sql
stable
security definer
set search_path = public
as $$
  select e.player_id, e.goals, e.assists
  from public.match_goal_entries e
  where e.match_id = p_match_id
    and auth.uid() is not null
    and public.can_view_match(p_match_id, auth.uid());
$$;

revoke execute on function public.get_match_goal_entries(uuid) from public;
revoke execute on function public.get_match_goal_entries(uuid) from anon;
grant execute on function public.get_match_goal_entries(uuid) to authenticated;
