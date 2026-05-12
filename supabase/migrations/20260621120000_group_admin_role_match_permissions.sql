-- Group admin role: promote/demote/kick members + group admin can manage group matches

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
-- Hem maçın organizatörü hem de maçın bağlı grubunun owner/admin'i yönetebilir.

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

-- ─── 9. RLS: self_report_requests ─────────────────────────────────────────────

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

-- can_view_self_report_request ve can_respond_to_self_report_request'teki
-- is_match_organizer referanslarını can_manage_group_match ile güncelle.

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

-- ─── 10. RPC: submit_match_result — is_match_organizer → can_manage_group_match

create or replace function public.submit_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_scorers jsonb default '[]'::jsonb,
  p_assists jsonb default '[]'::jsonb,
  p_own_goals jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  starts_ts timestamptz;
  v_old_sa int;
  v_old_sb int;
  v_old_st public.match_status;
  r_player uuid;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not (
    public.can_manage_group_match(p_match_id, uid)
    or public.match_rating_rater_can_participate(p_match_id, uid)
  ) then
    raise exception 'Yetkisiz işlem';
  end if;

  select m.starts_at into starts_ts
  from public.matches m
  where m.id = p_match_id;

  if starts_ts is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if now() < starts_ts + interval '60 minutes' then
    perform public.raise_app_error('ERR_MATCH_SCORE_BEFORE_END');
  end if;

  select m.score_a, m.score_b, m.status
  into v_old_sa, v_old_sb, v_old_st
  from public.matches m
  where m.id = p_match_id;

  drop table if exists _old_match_stats;
  create temp table _old_match_stats (
    player_id uuid not null,
    kind text not null,
    cnt bigint not null,
    primary key (player_id, kind)
  ) on commit drop;

  insert into _old_match_stats (player_id, kind, cnt)
  select
    s.player_id,
    s.kind::text,
    sum(s.count)::bigint
  from public.match_stat_lines s
  where s.match_id = p_match_id
  group by s.player_id, s.kind;

  delete from public.match_stat_lines
  where match_id = p_match_id;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'goal'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) elem
  group by p_match_id, (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'assist'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from jsonb_array_elements(coalesce(p_assists, '[]'::jsonb)) elem
  group by p_match_id, (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'own_goal'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from jsonb_array_elements(coalesce(p_own_goals, '[]'::jsonb)) elem
  group by p_match_id, (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    sr.match_id,
    sr.player_id,
    case
      when sr.type = 'goal'::public.self_report_type then 'goal'::public.stat_line_kind
      else 'assist'::public.stat_line_kind
    end,
    count(*)::int
  from public.self_report_requests sr
  where sr.match_id = p_match_id
    and sr.status = 'approved'
  group by sr.match_id, sr.player_id, sr.type
  on conflict (match_id, player_id, kind) do update
    set count = public.match_stat_lines.count + excluded.count;

  update public.matches
  set
    score_a = p_score_a,
    score_b = p_score_b,
    status = 'finished'::public.match_status,
    updated_at = now()
  where id = p_match_id;

  perform public.apply_player_rating_aggregate_deltas_from_submit(
    p_match_id,
    v_old_sa,
    v_old_sb,
    v_old_st,
    p_score_a,
    p_score_b
  );

  for r_player in
    select distinct mtp.player_id
    from public.match_team_players mtp
    where mtp.match_id = p_match_id
  loop
    perform public.refresh_goal_match_streak_for_player(r_player);
  end loop;

  perform public.spawn_next_weekly_match(p_match_id);
  perform public.drain_notification_deliveries();
end;
$$;

revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) from public;
revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) from anon;
grant execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) to authenticated;

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

  -- Owner hiçbir zaman kick edilemez
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
