# Supabase security hardening — rollout & rollback

Migration: [`supabase/migrations/20260523121500_security_hardening_profiles_aggregates_rpcs.sql`](../supabase/migrations/20260523121500_security_hardening_profiles_aggregates_rpcs.sql)

## What changed

1. **`public.profiles`**
   - `SELECT` for `authenticated`: **own row only** (`profiles_select_own`).
   - Sensitive fields (`iban`, `notification_preferences`) are no longer readable cross-user via the base table.

2. **`public.profiles_public`**
   - Recreated with **`security_invoker = false`**: roster UIs continue to resolve `id`, `display_name`, `photo_uri`, `position`, `preferred_foot` across users **without exposing** underlying sensitive columns.

3. **`match_player_rating_aggregates`, `player_rating_aggregates`**
   - **RLS enabled**, no policies for API roles — defense in depth beside table `GRANT`s.
   - `service_role` (Edge Functions, workers) still bypasses RLS as on Supabase.
  - Normal `authenticated`: if the role retains `SELECT` on these tables (e.g. default grants), Postgres returns **zero rows**, not **`42501`**, whenever RLS is enabled but no permissive SELECT policy exists.

4. **Trigger-returning routines in `public`**
   - `REVOKE ALL ... FROM public, anon, authenticated` applied dynamically to functions whose result type is `trigger`.
   - RPC surface stays limited to intentional `SECURITY DEFINER` business functions (`GRANT EXECUTE` from earlier migrations unchanged for those).

5. **App**
   - [`src/services/supabase/profiles.ts`](../src/services/supabase/profiles.ts): `fetchProfileById` only loads `profiles` for the signed-in user; avoids relying on leaky reads.

## Pre-deploy checklist

- [ ] Staging DB: apply migration (`supabase db push` / merge pipeline).
- [ ] SQL gates: `npm run test:rls:sql` (needs local `supabase start` + `supabase db reset` per project docs).
- [ ] HTTP gates (optional CI): `npm run test:rls:integration`.
- [ ] Smoke: sign-in → profile IBAN prefs → notifications settings save → roster / match screens that fetch `profiles_public`.

## Observability post-deploy

- Watch PostgREST / client logs for **`42501`** (permission denied), especially any legacy code path querying `profiles` for **other users**’ UUIDs — should use `profiles_public` or RPCs instead.

## Rollback strategy

Rolling back behavioral security changes should be deliberate:

1. **Forward fix preferred**: change any offending client/query to use `profiles_public` or an RPC rather than weakening RLS.

2. **Emergency DB rollback** (apply as a **new migration**, not deletion of merged history):

   ```sql
   drop policy if exists profiles_select_own on public.profiles;
   create policy profiles_select_authenticated on public.profiles
     for select to authenticated using (true);

   create or replace view public.profiles_public
   with (security_invoker = true) as
   select id, display_name, photo_uri, position, preferred_foot
   from public.profiles;

   grant select on table public.profiles_public to authenticated;

   alter table if exists public.match_player_rating_aggregates disable row level security;
   alter table if exists public.player_rating_aggregates disable row level security;
   ```

   Then re-grant **`EXECUTE` on trigger functions** only if Postgres version / tests proved those grants were strictly required for your workloads (normally they are not for end-user sessions).

3. Redeploy any app build that depended on tightened `fetchProfileById` semantics if you revert the TS guard.

## Ongoing hygiene

- When adding **`create function public.*`**, follow [`supabase/migrations/20260514120000_security_linter_hardening.sql`](../supabase/migrations/20260514120000_security_linter_hardening.sql): `revoke execute from public`, narrow `anon`, explicit `authenticated`/`service_role`.
- Prefer **Stable `ERR_*` tokens** inside definer RPCs (see `rpc_stable_error_codes` migrations).
