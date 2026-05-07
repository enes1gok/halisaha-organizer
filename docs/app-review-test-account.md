# App Review Test Account

Last updated: 2026-05-07

Use the following credentials in App Store Connect / Play Console review fields.

## Store fields

- Instruction name: `App Review Test Account`
- Username, email address or phone number: `review.halisaha+20260507@gmail.com`
- Password: `HalisahaReview!2026`

## Reviewer note (optional)

Use `Profil > Giris / kayit` to sign in.  
No 2FA is required for this review account.

## Operational rules during review

- Do not delete this user.
- Do not rotate this password until review is fully completed.
- If review is rejected because of auth access, create a new review user and update this file plus store metadata immediately.

## Supabase: `profiles` row must exist

The app maps the signed-in auth user to a row in `public.profiles` (same UUID as `auth.users.id`).  
 Normally this row is created by the `on_auth_user_created` trigger. If it is missing (older users, manual deletes), the mobile app calls the `ensure_my_profile` RPC after sign-in to insert a safe default row for `auth.uid()`.

**Verify for this test account (dashboard)**

1. Authentication → Users → open `review.halisaha+20260507@gmail.com` → copy **User UID**.
2. SQL Editor:

```sql
select id, display_name, created_at
from public.profiles
where id = '<paste-user-uid-here>';
```

3. Expect **one row**. If none, apply pending migrations (including `ensure_my_profile`), then sign in once with the app; the RPC should create the row. If it still fails, check RLS and that `grant execute on function public.ensure_my_profile() to authenticated` ran.
