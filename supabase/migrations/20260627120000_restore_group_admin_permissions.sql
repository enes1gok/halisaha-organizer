-- Emergency restore: 20260621120000_group_admin_role_match_permissions was recorded in
-- supabase_migrations but never executed on the remote DB (recorded-but-not-executed bug).
-- This migration idempotently recreates everything from that migration EXCEPT
-- submit_match_result, which was already updated by the applied 20260622120000 migration.

-- ─── 1. group_members.role: 'admin' değeri ekle ───────────────────────────────

alter table public.group_members
  drop constraint if exists group_members_role_check;

alter table public.group_members
  add constraint group_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- ─── 2. Helper: grup owner veya admin mi? ──────────────────────────────────────

create or replace function public.is_group_admin_or_owner(p_group_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.player_id = p_uid
      and gm.role in ('owner', 'admin')
  );
$$;

comment on function public.is_group_admin_or_owner(uuid, uuid) is
  'True when p_uid is owner or admin of p_group_id.';

-- ─── 3. Helper: maçı yönetebilir mi? ──────────────────────────────────────────

create or replace function public.can_manage_group_match(p_match_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (
        m.organizer_id = p_uid
        or (
          m.group_id is not null
          and public.is_group_admin_or_owner(m.group_id, p_uid)
        )
      )
  );
$$;

comment on function public.can_manage_group_match(uuid, uuid) is
  'True when p_uid is the match organizer, or is owner/admin of the group the match belongs to.';

-- ─── 4. RLS: matches ───────────────────────────────────────────────────────────

drop policy if exists matches_update_organizer on public.matches;
create policy matches_update_organizer on public.matches
  for update to authenticated
  using (public.can_manage_group_match(id, auth.uid()))
  with check (public.can_manage_group_match(id, auth.uid()));

-- ─── 5. RLS: match_team_players (kadro) ───────────────────────────────────────

drop policy if exists match_team_players_write_organizer on public.match_team_players;
create policy match_team_players_write_organizer on public.match_team_players
  for all to authenticated
  using (public.can_manage_group_match(match_id, auth.uid()))
  with check (public.can_manage_group_match(match_id, auth.uid()));

-- ─── 6. RLS: match_stat_lines (skor) ──────────────────────────────────────────

drop policy if exists match_stat_lines_write_organizer on public.match_stat_lines;
create policy match_stat_lines_write_organizer on public.match_stat_lines
  for all to authenticated
  using (public.can_manage_group_match(match_id, auth.uid()))
  with check (public.can_manage_group_match(match_id, auth.uid()));

-- ─── 7. RLS: match_attendees (ödeme / katılım — organizer güncellemesi) ────────

drop policy if exists match_attendees_update_organizer on public.match_attendees;
create policy match_attendees_update_organizer on public.match_attendees
  for update to authenticated
  using (
    player_id = auth.uid()
    or public.can_manage_group_match(match_id, auth.uid())
  )
  with check (
    player_id = auth.uid()
    or public.can_manage_group_match(match_id, auth.uid())
  );

-- ─── 8. RLS: match_attendees (insert — organizer ekleme) ──────────────────────

drop policy if exists match_attendees_insert_organizer on public.match_attendees;
create policy match_attendees_insert_organizer on public.match_attendees
  for insert to authenticated
  with check (public.can_manage_group_match(match_id, auth.uid()));

-- ─── 9. is_opposing_lineup_player_to_reporter (20260529, never applied) ──────

create or replace function public.is_opposing_lineup_player_to_reporter(
  p_match_id uuid,
  p_reporter_id uuid,
  p_viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_team_players r
    inner join public.match_team_players v
      on r.match_id = v.match_id
      and r.team <> v.team
    where r.match_id = p_match_id
      and r.player_id = p_reporter_id
      and v.player_id = p_viewer_id
  );
$$;

comment on function public.is_opposing_lineup_player_to_reporter(uuid, uuid, uuid) is
  'True when viewer and reporter are both on the match lineup on opposite teams (A vs B).';

revoke execute on function public.is_opposing_lineup_player_to_reporter(uuid, uuid, uuid) from public, anon;
grant execute on function public.is_opposing_lineup_player_to_reporter(uuid, uuid, uuid) to authenticated;

-- sync_approved_self_report_to_stat_lines trigger (20260529, never applied)

create or replace function public.sync_approved_self_report_to_stat_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mstatus public.match_status;
  v_kind public.stat_line_kind;
begin
  if tg_op <> 'UPDATE' then return new; end if;
  if new.status is distinct from 'approved'::public.self_report_status then return new; end if;
  if old.status = 'approved'::public.self_report_status then return new; end if;

  select m.status into mstatus from public.matches m where m.id = new.match_id;
  if mstatus is distinct from 'finished'::public.match_status then return new; end if;

  if new.type = 'goal'::public.self_report_type then
    v_kind := 'goal'::public.stat_line_kind;
  else
    v_kind := 'assist'::public.stat_line_kind;
  end if;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  values (new.match_id, new.player_id, v_kind, 1)
  on conflict (match_id, player_id, kind) do update
    set count = public.match_stat_lines.count + excluded.count;

  return new;
end;
$$;

drop trigger if exists self_report_requests_sync_stats_on_approve on public.self_report_requests;
create trigger self_report_requests_sync_stats_on_approve
  after update on public.self_report_requests for each row
  execute procedure public.sync_approved_self_report_to_stat_lines();

revoke execute on function public.sync_approved_self_report_to_stat_lines() from public, anon;

-- ─── 10. can_view / can_respond self_report helpers (before policies that use them) ──

create or replace function public.can_view_self_report_request(p_match_id uuid, p_reporter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_view_match(p_match_id, auth.uid())
    and (
      p_reporter_id = auth.uid()
      or public.can_manage_group_match(p_match_id, auth.uid())
      or public.is_opposing_lineup_player_to_reporter(p_match_id, p_reporter_id, auth.uid())
    );
$$;

create or replace function public.can_respond_to_self_report_request(p_match_id uuid, p_reporter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      public.can_manage_group_match(p_match_id, auth.uid())
      and (
        p_reporter_id is distinct from auth.uid()
        or not exists (
          select 1
          from public.match_team_players t
          where t.match_id = p_match_id
            and t.player_id = p_reporter_id
        )
      )
    )
    or (
      p_reporter_id is distinct from auth.uid()
      and public.is_opposing_lineup_player_to_reporter(p_match_id, p_reporter_id, auth.uid())
    );
$$;

-- ─── 10. RLS: self_report_requests ────────────────────────────────────────────

drop policy if exists self_reports_select on public.self_report_requests;
create policy self_reports_select on public.self_report_requests
  for select to authenticated
  using (public.can_view_self_report_request(match_id, player_id));

drop policy if exists self_reports_update_organizer on public.self_report_requests;
create policy self_reports_update_organizer on public.self_report_requests
  for update to authenticated
  using (public.can_respond_to_self_report_request(match_id, player_id))
  with check (public.can_respond_to_self_report_request(match_id, player_id));

drop policy if exists self_reports_delete_organizer on public.self_report_requests;
create policy self_reports_delete_organizer on public.self_report_requests
  for delete to authenticated
  using (public.can_respond_to_self_report_request(match_id, player_id));

-- ─── 11. RPC: kick_group_member ────────────────────────────────────────────────

create or replace function public.kick_group_member(p_group_id uuid, p_target_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role
  from public.group_members
  where group_id = p_group_id and player_id = auth.uid();

  if caller_role not in ('owner', 'admin') then
    perform public.raise_app_error('ERR_FORBIDDEN');
  end if;

  select role into target_role
  from public.group_members
  where group_id = p_group_id and player_id = p_target_player_id;

  if target_role is null then
    perform public.raise_app_error('ERR_NOT_FOUND');
  end if;

  if target_role = 'owner' then
    perform public.raise_app_error('ERR_FORBIDDEN');
  end if;

  delete from public.group_members
  where group_id = p_group_id and player_id = p_target_player_id;
end;
$$;

comment on function public.kick_group_member(uuid, uuid) is
  'Owner or admin can kick any non-owner member. Owner cannot be kicked.';

-- ─── 12. RPC: set_group_member_role ───────────────────────────────────────────

create or replace function public.set_group_member_role(
  p_group_id uuid,
  p_target_player_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if p_role not in ('admin', 'member') then
    perform public.raise_app_error('ERR_INVALID_INPUT');
  end if;

  select role into caller_role
  from public.group_members
  where group_id = p_group_id and player_id = auth.uid();

  if caller_role <> 'owner' then
    perform public.raise_app_error('ERR_FORBIDDEN');
  end if;

  update public.group_members
  set role = p_role
  where group_id = p_group_id and player_id = p_target_player_id;
end;
$$;

comment on function public.set_group_member_role(uuid, uuid, text) is
  'Only group owner can promote to admin or demote back to member. Cannot set owner role via this RPC.';

-- ─── 13. Grants ────────────────────────────────────────────────────────────────

revoke execute on function public.is_group_admin_or_owner(uuid, uuid) from public, anon;
grant execute on function public.is_group_admin_or_owner(uuid, uuid) to authenticated;

revoke execute on function public.can_manage_group_match(uuid, uuid) from public, anon;
grant execute on function public.can_manage_group_match(uuid, uuid) to authenticated;

revoke execute on function public.kick_group_member(uuid, uuid) from public, anon;
grant execute on function public.kick_group_member(uuid, uuid) to authenticated;

revoke execute on function public.set_group_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_group_member_role(uuid, uuid, text) to authenticated;
