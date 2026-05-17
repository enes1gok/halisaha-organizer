-- Match guest attendees: players without the app added by organizer to complete the squad.
-- Two new tables: match_guest_attendees (guest roster) and match_guest_team_assignments (lineup).
-- Three new RPCs: add_match_guest, remove_match_guest, set_match_teams_v2.

-- ────────────────────────────────────────────────
-- Tables
-- ────────────────────────────────────────────────

create table public.match_guest_attendees (
  id           uuid        primary key default gen_random_uuid(),
  match_id     uuid        not null references public.matches(id) on delete cascade,
  display_name text        not null,
  position     public.player_position not null default 'MID',
  paid         boolean     not null default false,
  added_by     uuid        not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint guest_name_len check (length(trim(display_name)) between 1 and 64)
);

create index match_guest_attendees_match_id_idx
  on public.match_guest_attendees (match_id);

create table public.match_guest_team_assignments (
  match_id uuid              not null references public.matches(id) on delete cascade,
  guest_id uuid              not null references public.match_guest_attendees(id) on delete cascade,
  team     public.team_side  not null,
  primary key (match_id, guest_id)
);

create index match_guest_team_assignments_match_id_idx
  on public.match_guest_team_assignments (match_id);

-- ────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────

alter table public.match_guest_attendees enable row level security;
alter table public.match_guest_team_assignments enable row level security;

-- Guest attendees: readable by anyone who can view the match
create policy mga_select on public.match_guest_attendees
  for select to authenticated
  using (public.can_view_match(match_id, auth.uid()));

-- Guest attendees: writable only by match organizer / group admin
create policy mga_insert on public.match_guest_attendees
  for insert to authenticated
  with check (public.can_manage_group_match(match_id, auth.uid()));

create policy mga_update on public.match_guest_attendees
  for update to authenticated
  using  (public.can_manage_group_match(match_id, auth.uid()))
  with check (public.can_manage_group_match(match_id, auth.uid()));

create policy mga_delete on public.match_guest_attendees
  for delete to authenticated
  using (public.can_manage_group_match(match_id, auth.uid()));

-- Guest team assignments: readable by anyone who can view the match
create policy mgta_select on public.match_guest_team_assignments
  for select to authenticated
  using (public.can_view_match(match_id, auth.uid()));

-- Guest team assignments: writable only by match organizer / group admin
create policy mgta_write on public.match_guest_team_assignments
  for all to authenticated
  using  (public.can_manage_group_match(match_id, auth.uid()))
  with check (public.can_manage_group_match(match_id, auth.uid()));

-- ────────────────────────────────────────────────
-- RPC: add_match_guest
-- Adds a guest player to a match. Organizer/group admin only.
-- Blocked when lineup is locked or match is not upcoming/ongoing.
-- ────────────────────────────────────────────────

create or replace function public.add_match_guest(
  p_match_id     uuid,
  p_display_name text,
  p_position     public.player_position default 'MID'
)
returns public.match_guest_attendees
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row public.match_guest_attendees;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if not public.can_manage_group_match(p_match_id, uid) then
    perform public.raise_app_error('ERR_NOT_AUTHORIZED');
  end if;

  if length(trim(coalesce(p_display_name, ''))) < 1 then
    perform public.raise_app_error('ERR_INVALID_INPUT');
  end if;

  if exists (
    select 1 from public.matches
    where id = p_match_id
      and (lineup_locked or status not in ('upcoming', 'ongoing'))
  ) then
    perform public.raise_app_error('ERR_MATCH_LINEUP_LOCKED');
  end if;

  insert into public.match_guest_attendees (match_id, display_name, position, added_by)
  values (p_match_id, trim(p_display_name), p_position, uid)
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.add_match_guest(uuid, text, public.player_position)
  from public, anon;
grant  execute on function public.add_match_guest(uuid, text, public.player_position)
  to authenticated;

-- ────────────────────────────────────────────────
-- RPC: remove_match_guest
-- Deletes a guest player (cascades to team assignment).
-- Organizer/group admin only.
-- ────────────────────────────────────────────────

create or replace function public.remove_match_guest(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  v_match uuid;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  select match_id into v_match
  from public.match_guest_attendees
  where id = p_guest_id;

  if v_match is null then
    perform public.raise_app_error('ERR_NOT_FOUND');
  end if;

  if not public.can_manage_group_match(v_match, uid) then
    perform public.raise_app_error('ERR_NOT_AUTHORIZED');
  end if;

  delete from public.match_guest_attendees where id = p_guest_id;
end;
$$;

revoke execute on function public.remove_match_guest(uuid) from public, anon;
grant  execute on function public.remove_match_guest(uuid) to authenticated;

-- ────────────────────────────────────────────────
-- RPC: set_match_teams_v2
-- Atomically replaces registered + guest team assignments.
-- Supersedes the client-side delete+insert pair for match_team_players.
-- ────────────────────────────────────────────────

create or replace function public.set_match_teams_v2(
  p_match_id          uuid,
  p_team_a_player_ids uuid[],
  p_team_b_player_ids uuid[],
  p_team_a_guest_ids  uuid[] default array[]::uuid[],
  p_team_b_guest_ids  uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if not public.can_manage_group_match(p_match_id, uid) then
    perform public.raise_app_error('ERR_NOT_AUTHORIZED');
  end if;

  -- Replace registered team players
  delete from public.match_team_players where match_id = p_match_id;

  insert into public.match_team_players (match_id, player_id, team)
  select p_match_id, unnest(p_team_a_player_ids), 'A'::public.team_side;

  insert into public.match_team_players (match_id, player_id, team)
  select p_match_id, unnest(p_team_b_player_ids), 'B'::public.team_side;

  -- Replace guest team assignments
  delete from public.match_guest_team_assignments where match_id = p_match_id;

  insert into public.match_guest_team_assignments (match_id, guest_id, team)
  select p_match_id, unnest(p_team_a_guest_ids), 'A'::public.team_side;

  insert into public.match_guest_team_assignments (match_id, guest_id, team)
  select p_match_id, unnest(p_team_b_guest_ids), 'B'::public.team_side;
end;
$$;

revoke execute on function public.set_match_teams_v2(uuid, uuid[], uuid[], uuid[], uuid[])
  from public, anon;
grant  execute on function public.set_match_teams_v2(uuid, uuid[], uuid[], uuid[], uuid[])
  to authenticated;
