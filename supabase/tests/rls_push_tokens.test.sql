begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

insert into public.push_tokens (id, user_id, token, platform, is_active)
values (
  gen_random_uuid(),
  tests.uuid_organizer(),
  'tok-organizer-1',
  'ios',
  true
);

select tests.authenticate_as(tests.uuid_organizer());
select isnt_empty(
  $$ select 1 from public.push_tokens where user_id = tests.uuid_organizer() $$,
  'user reads own push tokens'
);

select lives_ok(
  $$ insert into public.push_tokens (user_id, token, platform, is_active)
     values (tests.uuid_organizer(), 'tok-organizer-2', 'android', true) $$,
  'user inserts own push token'
);

select lives_ok(
  $$ update public.push_tokens set is_active = false where token = 'tok-organizer-1' $$,
  'user updates own token'
);

select throws_ok(
  $$ insert into public.push_tokens (user_id, token, platform, is_active)
     values (tests.uuid_participant(), 'evil', 'ios', true) $$,
  '42501'
);

select tests.authenticate_as(tests.uuid_participant());
select is_empty(
  $$ select 1 from public.push_tokens where user_id = tests.uuid_organizer() $$,
  'cannot read other users tokens'
);

delete from public.push_tokens where user_id = tests.uuid_organizer();
select isnt_empty(
  $$ select 1 from public.push_tokens where user_id = tests.uuid_organizer() $$,
  'no delete policy: rows remain after delete attempt'
);

select * from finish();

rollback;
