begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

select throws_ok(
  $$ select public.raise_app_error('ERR_AUTH_REQUIRED'::text, '{"field":"x"}'::jsonb) $$,
  'P0001',
  'ERR_AUTH_REQUIRED',
  'raise_app_error uses P0001 and ERR_* token as message body'
);

select * from finish();

rollback;
