-- Maç finished → match_result kuyruğu (going, organizatör hariç); tercih kapalıyında satır yok.

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select tests.reset_session();

select tests.create_user('f1000000-0000-4000-8000-000000000010'::uuid);
select tests.create_user('f1000000-0000-4000-8000-000000000011'::uuid);

insert into public.groups (id, name, owner_id, join_code)
values (
  'f2000000-0000-4000-8000-000000000020'::uuid,
  'Result Group',
  'f1000000-0000-4000-8000-000000000010'::uuid,
  'GRPCMR20'
);

insert into public.group_members (group_id, player_id, role)
values
  ('f2000000-0000-4000-8000-000000000020'::uuid, 'f1000000-0000-4000-8000-000000000010'::uuid, 'owner'),
  ('f2000000-0000-4000-8000-000000000020'::uuid, 'f1000000-0000-4000-8000-000000000011'::uuid, 'member');

insert into public.push_tokens (user_id, token, platform, is_active)
values
  ('f1000000-0000-4000-8000-000000000010'::uuid, 'tok-res-org', 'ios', true),
  ('f1000000-0000-4000-8000-000000000011'::uuid, 'tok-res-mem', 'ios', true);

insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  group_id,
  max_players,
  status,
  lineup_locked
)
values (
  'f3000000-0000-4000-8000-000000000030'::uuid,
  now() + interval '2 hours',
  'Saha MR',
  'f1000000-0000-4000-8000-000000000010'::uuid,
  'MTMR030',
  'f2000000-0000-4000-8000-000000000020'::uuid,
  10,
  'upcoming'::public.match_status,
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f3000000-0000-4000-8000-000000000030'::uuid, 'f1000000-0000-4000-8000-000000000010'::uuid, 'going', false),
  ('f3000000-0000-4000-8000-000000000030'::uuid, 'f1000000-0000-4000-8000-000000000011'::uuid, 'going', false);

update public.matches
set
  status = 'finished'::public.match_status,
  score_a = 3,
  score_b = 2
where id = 'f3000000-0000-4000-8000-000000000030'::uuid;

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f3000000-0000-4000-8000-000000000030'::uuid
     and type = 'match_result'),
  1,
  'tek match_result (going üye)'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'f3000000-0000-4000-8000-000000000030'::uuid
       and type = 'match_result'
       and recipient_id = 'f1000000-0000-4000-8000-000000000010'::uuid $$,
  'organizatör almaz'
);

select is(
  (select recipient_id from public.notification_deliveries
   where match_id = 'f3000000-0000-4000-8000-000000000030'::uuid
     and type = 'match_result'
   limit 1),
  'f1000000-0000-4000-8000-000000000011'::uuid,
  'alıcıüye'
);

-- İkinci maç: maç sonucu bildirimi kapalı
-- PG17: jsonb_set(target,'{types,key}',…) from '{}' does not nest; merge explicitly.
update public.profiles
set notification_preferences =
  coalesce(notification_preferences, '{}'::jsonb)
  || jsonb_build_object(
       'types',
       coalesce(notification_preferences->'types', '{}'::jsonb)
       || jsonb_build_object('group_match_match_result', false)
     )
where id = 'f1000000-0000-4000-8000-000000000011'::uuid;

insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  group_id,
  max_players,
  status,
  lineup_locked
)
values (
  'f3000000-0000-4000-8000-000000000031'::uuid,
  now() + interval '2 hours',
  'Saha MR2',
  'f1000000-0000-4000-8000-000000000010'::uuid,
  'MTMR031',
  'f2000000-0000-4000-8000-000000000020'::uuid,
  10,
  'upcoming'::public.match_status,
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f3000000-0000-4000-8000-000000000031'::uuid, 'f1000000-0000-4000-8000-000000000010'::uuid, 'going', false),
  ('f3000000-0000-4000-8000-000000000031'::uuid, 'f1000000-0000-4000-8000-000000000011'::uuid, 'going', false);

update public.matches
set
  status = 'finished'::public.match_status,
  score_a = 1,
  score_b = 1
where id = 'f3000000-0000-4000-8000-000000000031'::uuid;

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f3000000-0000-4000-8000-000000000031'::uuid
     and type = 'match_result'),
  0,
  'tercih kapalıyken match_result yok'
);

select * from finish();

rollback;
