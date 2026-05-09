begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_non_member());

-- Group visible only to organizer (member row)
insert into public.groups (id, name, owner_id, join_code)
values (
  'd0000000-0000-4000-8000-000000000050'::uuid,
  'RPC Group',
  tests.uuid_organizer(),
  'GRPCRPC50'
);

insert into public.group_members (group_id, player_id, role)
values (
  'd0000000-0000-4000-8000-000000000050'::uuid,
  tests.uuid_organizer(),
  'owner'
);

-- 1) Superuser session without JWT: ERR_AUTH_REQUIRED
select tests.reset_session();
select throws_ok(
  $$ select public.create_match_with_organizer_attendee(
    now() + interval '1 day',
    'Venue rpc'::text,
    14::int,
    'ZZRPC01'::text,
    null::uuid,
    null::numeric,
    null::text
  ) $$,
  'P0001',
  'ERR_AUTH_REQUIRED',
  'create_match_without_jwt_requires_auth'
);

-- 2) Non-member cannot attach match to group
select tests.authenticate_as(tests.uuid_non_member());
select throws_ok(
  $$ select public.create_match_with_organizer_attendee(
    now() + interval '1 day',
    'Venue rpc'::text,
    14::int,
    'ZZRPC02'::text,
    'd0000000-0000-4000-8000-000000000050'::uuid,
    null::numeric,
    null::text
  ) $$,
  'P0001',
  'ERR_MATCH_CREATE_GROUP_FORBIDDEN',
  'non_member_cannot_create_group_scoped_match'
);

-- 3) Organizer creates standalone match via RPC
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ select public.create_match_with_organizer_attendee(
    now() + interval '1 day',
    'Venue rpc'::text,
    14::int,
    'ZZRPC03'::text,
    null::uuid,
    null::numeric,
    null::text,
    'cash'::text
  ) $$,
  'organizer_creates_match_via_rpc'
);

-- 4) Organizer creates group-scoped match
select lives_ok(
  $$ select public.create_match_with_organizer_attendee(
    now() + interval '2 day',
    'Venue grp'::text,
    14::int,
    'ZZRPC04'::text,
    'd0000000-0000-4000-8000-000000000050'::uuid,
    null::numeric,
    null::text,
    'cash'::text
  ) $$,
  'organizer_creates_group_match_via_rpc'
);

-- 5) IBAN mode requires iban and iban account name
select throws_ok(
  $$ select public.create_match_with_organizer_attendee(
    now() + interval '3 day',
    'Venue iban invalid'::text,
    14::int,
    'ZZRPC05'::text,
    null::uuid,
    120::numeric,
    null::text,
    'iban'::text,
    null::text
  ) $$,
  'P0001',
  'ERR_MATCH_PAYMENT_IBAN_REQUIRED',
  'iban_mode_requires_payment_details'
);

-- 6) Cash mode succeeds without iban details
select lives_ok(
  $$ select public.create_match_with_organizer_attendee(
    now() + interval '4 day',
    'Venue cash'::text,
    14::int,
    'ZZRPC06'::text,
    null::uuid,
    120::numeric,
    null::text,
    'cash'::text,
    null::text
  ) $$,
  'cash_mode_creates_match_without_iban'
);

-- 7) note_only mode requires payment_note
select throws_ok(
  $$ select public.create_match_with_organizer_attendee(
    now() + interval '5 day',
    'Venue note invalid'::text,
    14::int,
    'ZZRPC07'::text,
    null::uuid,
    null::numeric,
    null::text,
    'note_only'::text,
    null::text,
    null::text
  ) $$,
  'P0001',
  'ERR_MATCH_PAYMENT_NOTE_REQUIRED',
  'note_only_requires_payment_note'
);

-- 8) note_only mode accepts note and rejects iban fields
select lives_ok(
  $$ select public.create_match_with_organizer_attendee(
    now() + interval '6 day',
    'Venue note ok'::text,
    14::int,
    'ZZRPC08'::text,
    null::uuid,
    null::numeric,
    null::text,
    'note_only'::text,
    null::text,
    'Topu herkes kendi getirsin.'::text
  ) $$,
  'note_only_creates_match_with_payment_note'
);

select * from finish();

rollback;
