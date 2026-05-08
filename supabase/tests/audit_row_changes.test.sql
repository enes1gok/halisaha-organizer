begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());

-- Superuser session reads audit; signup creates a profiles INSERT audit row.
select ok(
  (select count(*)::int from audit.row_changes where table_name = 'profiles' and op = 'INSERT') >= 1,
  'profiles insert is audited after user signup'
);

update public.profiles
set display_name = 'AuditDisplayName'
where id = tests.uuid_organizer();

select ok(
  (select count(*)::int from audit.row_changes where table_name = 'profiles' and op = 'UPDATE') >= 1,
  'profiles update is audited'
);

update public.profiles
set iban = 'TR330006100519786457841326'
where id = tests.uuid_organizer();

select isnt_empty(
  $$ select 1 from audit.row_changes
     where table_name = 'profiles'
       and new_data->>'iban' = '[REDACTED]'
     order by id desc limit 1 $$,
  'iban redacted in audited new_data'
);

-- Authenticated role cannot read audit rows (RLS, no policy).
select tests.authenticate_as(tests.uuid_organizer());
select is_empty(
  $$ select 1 from audit.row_changes limit 1 $$,
  'authenticated role sees no audit rows'
);

select * from finish();

rollback;
