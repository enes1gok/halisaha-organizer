begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

-- Match: upcoming (stat lines in DB should still not surface until finished)
insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  payment_method
)
values (
  'e0000000-0000-4000-8000-000000000070'::uuid,
  now() + interval '1 day',
  'Graph payload venue',
  tests.uuid_organizer(),
  'GRAPH070',
  'cash'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values ('e0000000-0000-4000-8000-000000000070'::uuid, tests.uuid_participant(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values ('e0000000-0000-4000-8000-000000000070'::uuid, tests.uuid_organizer(), 'A');

insert into public.self_report_requests (match_id, player_id, type, status)
values (
  'e0000000-0000-4000-8000-000000000070'::uuid,
  tests.uuid_participant(),
  'goal'::public.self_report_type,
  'pending'::public.self_report_status
);

-- Stray goal row while match still upcoming (should be filtered out of graph JSON)
insert into public.match_stat_lines (match_id, player_id, kind, count)
values (
  'e0000000-0000-4000-8000-000000000070'::uuid,
  tests.uuid_organizer(),
  'goal'::public.stat_line_kind,
  1
);

select tests.authenticate_as(tests.uuid_organizer());

select ok(
  (
    select jsonb_array_length(stat_lines) = 0
    from public.list_visible_match_graphs_for_user(null)
    where id = 'e0000000-0000-4000-8000-000000000070'::uuid
  ),
  'upcoming_match_graph_has_empty_stat_lines_even_if_rows_exist'
);

select ok(
  (
    select jsonb_array_length(self_reports) = 0
    from public.list_visible_match_summaries_for_user(null)
    where id = 'e0000000-0000-4000-8000-000000000070'::uuid
  ),
  'summary_rpc_has_empty_self_reports_array'
);

select ok(
  (
    select jsonb_array_length(stat_lines) = 0
    from public.list_visible_match_summaries_for_user(null)
    where id = 'e0000000-0000-4000-8000-000000000070'::uuid
  ),
  'summary_rpc_has_empty_stat_lines_array'
);

-- Finish match: stat lines should aggregate
update public.matches
set status = 'finished'::public.match_status,
  score_a = 1,
  score_b = 0
where id = 'e0000000-0000-4000-8000-000000000070'::uuid;

select ok(
  (
    select jsonb_array_length(stat_lines) > 0
    from public.list_visible_match_graphs_for_user(null)
    where id = 'e0000000-0000-4000-8000-000000000070'::uuid
  ),
  'finished_match_graph_includes_stat_lines'
);

select ok(
  (
    select not exists (
      select 1
      from jsonb_array_elements(self_reports) elem
      where elem ? 'created_at'
    )
    from public.list_visible_match_graphs_for_user(null)
    where id = 'e0000000-0000-4000-8000-000000000070'::uuid
  ),
  'self_reports_json_objects_have_no_created_at_key'
);

select ok(
  (
    select jsonb_array_length(self_reports) >= 1
    from public.list_visible_match_graphs_for_user(null)
    where id = 'e0000000-0000-4000-8000-000000000070'::uuid
  ),
  'finished_match_graph_lists_self_reports'
);

select * from finish();

rollback;
