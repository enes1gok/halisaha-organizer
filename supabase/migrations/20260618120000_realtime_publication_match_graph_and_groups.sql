-- Enable Postgres Realtime (postgres_changes) for match graph + groups.
-- Idempotent: skip if table is already in supabase_realtime publication.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'public.matches',
    'public.match_attendees',
    'public.match_team_players',
    'public.match_stat_lines',
    'public.self_report_requests',
    'public.groups',
    'public.group_members'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table only %s', tbl);
    exception
      when duplicate_object then
        null;
      when others then
        if sqlerrm like '%already member%' or sqlerrm like '%already part of%' then
          null;
        else
          raise;
        end if;
    end;
  end loop;
end;
$$;
