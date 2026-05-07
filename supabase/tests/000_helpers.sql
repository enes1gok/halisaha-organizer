-- Shared helpers for pgTAP RLS tests (run first: 000_ prefix).
-- Assumes superuser/session can SET ROLE and insert into auth.users.

-- crypt / gen_salt for tests.create_user (encrypted_password).
create extension if not exists pgcrypto with schema extensions;

create schema if not exists tests;

-- Fixed UUIDs for deterministic tests (v4-style).
create or replace function tests.uuid_organizer()
returns uuid
language sql
immutable
as $$
  select 'a0000000-0000-4000-8000-000000000001'::uuid;
$$;

create or replace function tests.uuid_participant()
returns uuid
language sql
immutable
as $$
  select 'a0000000-0000-4000-8000-000000000002'::uuid;
$$;

create or replace function tests.uuid_non_member()
returns uuid
language sql
immutable
as $$
  select 'a0000000-0000-4000-8000-000000000003'::uuid;
$$;

create or replace function tests.uuid_group_extra()
returns uuid
language sql
immutable
as $$
  select 'a0000000-0000-4000-8000-000000000004'::uuid;
$$;

-- Insert auth.users (+ trigger creates public.profiles). Idempotent per id.
create or replace function tests.create_user(p_id uuid, p_email text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := coalesce(p_email, replace(p_id::text, '-', '') || '@rls-test.local');
begin
  if exists (select 1 from auth.users where id = p_id) then
    return;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt('TestPass123!', extensions.gen_salt('bf'::text)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  );
end;
$$;

-- Emulate PostgREST JWT for RLS (auth.uid() reads request.jwt.claims).
create or replace function tests.authenticate_as(p_sub uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_sub::text, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$$;

create or replace function tests.authenticate_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end;
$$;

-- Back to privileged session (RLS bypass for fixture inserts).
create or replace function tests.reset_session()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

grant usage on schema tests to postgres;
grant execute on all functions in schema tests to postgres;
