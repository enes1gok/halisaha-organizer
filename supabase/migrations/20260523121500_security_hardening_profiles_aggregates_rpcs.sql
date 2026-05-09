-- Security hardening (see docs/supabase-security-hardening-rollout.md).
-- - profiles: SELECT limited to own row (iban, notification_preferences stay private).
-- - profiles_public: security_invoker = false so callers read only projected public columns via view owner privileges.
-- - rating aggregate tables: RLS enabled, no client policies (service_role bypasses RLS in Supabase).
-- - public trigger-returning functions: ALL privileges revoked from anon/authenticated/public (client RPC surface stays on non-trigger functions only).

-- --- 1) Public roster view: allow cross-user reads of NON-sensitive columns only ---

create or replace view public.profiles_public
with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.photo_uri,
  p.position,
  p.preferred_foot
from public.profiles p;

grant select on table public.profiles_public to authenticated;

comment on view public.profiles_public is
  'Non-sensitive profile fields only. security_invoker=false: view owner evaluates base rows; callers never receive iban/preferences.';

-- --- 2) profiles: SELECT own row only ---

drop policy if exists profiles_select_authenticated on public.profiles;

drop policy if exists profiles_select_own on public.profiles;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid());

comment on policy profiles_select_own on public.profiles is
  'Full-row profile reads are own-user only (iban + notification_preferences). Use profiles_public for cross-user roster.';

-- --- 3) Defense-in-depth RLS on internal aggregate rating tables ---

alter table if exists public.match_player_rating_aggregates enable row level security;

alter table if exists public.player_rating_aggregates enable row level security;

-- --- 4) Revoke client access to trigger-returning functions ---
do $$
declare
  trig oid := 'pg_catalog.trigger'::regtype;
  fq text;
begin
  for fq in
    select format(
             '%I.%I(%s)',
             ns.nspname,
             p.proname,
             pg_catalog.pg_get_function_identity_arguments(p.oid)
           )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prorettype = trig
  loop
    begin execute format('revoke all on function %s from public;', fq);
    exception when others then null;
    end;
    begin execute format('revoke all on function %s from anon;', fq);
    exception when others then null;
    end;
    begin execute format('revoke all on function %s from authenticated;', fq);
    exception when others then null;
    end;
  end loop;
end $$;
