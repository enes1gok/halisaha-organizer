begin;

create extension if not exists pgtap with schema extensions;

-- RLS with no permissive SELECT policies hides all rows — does NOT raise 42501
-- unless the role lacks SELECT on the relation entirely.
select plan(4);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

insert into public.matches (id, starts_at, venue, organizer_id, join_code, status, score_a, score_b)
values (
  'b0000000-0000-4000-8000-000000000050'::uuid,
  now() - interval '1 day',
  'Saha',
  tests.uuid_organizer(),
  'AGGRLS50',
  'finished',
  1,
  0
);

-- Seed aggregate row as privileged session (mirrors service-side writes)
insert into public.match_player_rating_aggregates (
  match_id,
  player_id,
  score_total,
  vote_count
)
values (
  'b0000000-0000-4000-8000-000000000050'::uuid,
  tests.uuid_participant(),
  80,
  1
);

insert into public.player_rating_aggregates (player_id, score_total, vote_count)
values (tests.uuid_participant(), 80, 1)
on conflict (player_id)
do nothing;

-- Visible to privileged reader (baseline)
select isnt_empty($$ select 1 from public.match_player_rating_aggregates $$, 'fixture: match aggregates row exists');

select isnt_empty($$ select 1 from public.player_rating_aggregates $$, 'fixture: player aggregates row exists');

select tests.authenticate_as(tests.uuid_organizer());

select is(
  (
    select count(*)::bigint
    from public.match_player_rating_aggregates
  ),
  0::bigint,
  'authenticated sees zero match_player_rating_aggregates rows (RLS no policy)'
);

select is(
  (select count(*)::bigint from public.player_rating_aggregates),
  0::bigint,
  'authenticated sees zero player_rating_aggregates rows (RLS no policy)'
);

select * from finish();

rollback;
