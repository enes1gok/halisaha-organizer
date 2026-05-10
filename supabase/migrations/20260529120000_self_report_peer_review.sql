-- Peer review: opposing team can see/respond to self-report drafts; sync stat lines when approving after match finished.

-- --- Helpers (SECURITY DEFINER; used by RLS) ---

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
    select
      1
    from
      public.match_team_players r
      inner join public.match_team_players v
        on r.match_id = v.match_id
        and r.team <> v.team
    where
      r.match_id = p_match_id
      and r.player_id = p_reporter_id
      and v.player_id = p_viewer_id
  );
$$;

comment on function public.is_opposing_lineup_player_to_reporter(uuid, uuid, uuid) is
  'True when viewer and reporter are both on the match lineup on opposite teams (A vs B).';

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
      or public.is_match_organizer(p_match_id, auth.uid())
      or public.is_opposing_lineup_player_to_reporter(p_match_id, p_reporter_id, auth.uid())
    );
$$;

comment on function public.can_view_self_report_request(uuid, uuid) is
  'Self-report row visible to reporter, match organizer, or an opposing lineup player.';

create or replace function public.can_respond_to_self_report_request(p_match_id uuid, p_reporter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      public.is_match_organizer(p_match_id, auth.uid())
      and (
        p_reporter_id is distinct from auth.uid()
        or not exists (
          select
            1
          from
            public.match_team_players t
          where
            t.match_id = p_match_id
            and t.player_id = p_reporter_id
        )
      )
    )
    or (
      p_reporter_id is distinct from auth.uid()
      and public.is_opposing_lineup_player_to_reporter(p_match_id, p_reporter_id, auth.uid())
    );
$$;

comment on function public.can_respond_to_self_report_request(uuid, uuid) is
  'Organizer (with self-approve exception when reporter has no lineup row) or opposing lineup player; never self-approve when reporter is on a team.';

-- --- RLS: self_report_requests ---

drop policy if exists self_reports_select on public.self_report_requests;
create policy self_reports_select on public.self_report_requests for
select
  to authenticated using (public.can_view_self_report_request(match_id, player_id));

drop policy if exists self_reports_update_organizer on public.self_report_requests;
create policy self_reports_update_responder on public.self_report_requests for
update to authenticated using (public.can_respond_to_self_report_request(match_id, player_id))
with
  check (public.can_respond_to_self_report_request(match_id, player_id));

-- --- After approval on finished match: merge into match_stat_lines (peers cannot write stat_lines via RLS) ---

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
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is distinct from 'approved'::public.self_report_status then
    return new;
  end if;

  if old.status = 'approved'::public.self_report_status then
    return new;
  end if;

  select
    m.status into mstatus
  from
    public.matches m
  where
    m.id = new.match_id;

  if mstatus is distinct from 'finished'::public.match_status then
    return new;
  end if;

  if new.type = 'goal'::public.self_report_type then
    v_kind := 'goal'::public.stat_line_kind;
  else
    v_kind := 'assist'::public.stat_line_kind;
  end if;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  values (new.match_id, new.player_id, v_kind, 1)
  on conflict (match_id, player_id, kind) do update
  set
    count = public.match_stat_lines.count + excluded.count;

  return new;
end;
$$;

drop trigger if exists self_report_requests_sync_stats_on_approve on public.self_report_requests;

create trigger self_report_requests_sync_stats_on_approve
after update on public.self_report_requests for each row
execute procedure public.sync_approved_self_report_to_stat_lines();

-- --- Grants / revokes (align with security_linter_hardening) ---

revoke execute on function public.is_opposing_lineup_player_to_reporter(uuid, uuid, uuid) from public;
revoke execute on function public.can_view_self_report_request(uuid, uuid) from public;
revoke execute on function public.can_respond_to_self_report_request(uuid, uuid) from public;
revoke execute on function public.sync_approved_self_report_to_stat_lines() from public;

grant execute on function public.is_opposing_lineup_player_to_reporter(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_view_self_report_request(uuid, uuid) to authenticated;
grant execute on function public.can_respond_to_self_report_request(uuid, uuid) to authenticated;

revoke execute on function public.is_opposing_lineup_player_to_reporter(uuid, uuid, uuid) from anon;
revoke execute on function public.can_view_self_report_request(uuid, uuid) from anon;
revoke execute on function public.can_respond_to_self_report_request(uuid, uuid) from anon;
