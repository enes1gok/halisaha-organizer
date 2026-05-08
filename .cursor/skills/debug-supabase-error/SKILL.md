---
name: debug-supabase-error
description: Step-by-step playbook for diagnosing Supabase/Postgres errors (SQLSTATE, RLS, RPC).
---

# Debug Supabase error

Use when investigating a failing RPC, RLS denial, or `AppError` from `mapSupabaseError`.

## 1. SQLSTATE / code

- Interpret Postgres classes: `23505` unique violation, `42501` permission denied, `23514` check violation, `P0001` raised exception (app **`ERR_*`** via `raise_app_error`).
- Read **`AppError.meta.supabase`** / raw PostgREST **`message`**, **`details`**, **`hint`**.

## 2. Stable `ERR_*` token

- If **`message`** or combined text contains **`ERR_SNAKE_CASE`**, find it in **`ERR_REGISTRY`** in [`src/services/supabase/errors.ts`](../../src/services/supabase/errors.ts) and the matching migration where **`raise_app_error`** / **`perform public.raise_app_error`** is used.

## 3. RLS / `42501`

- Confirm JWT / session: `auth.uid()` present for `authenticated` routes.
- Compare table **RLS policies** in `supabase/migrations` with the operation (select vs insert). Use helpers (`is_match_organizer`, `can_view_group`, …) as documented in migrations.

## 4. RPC trace

- Locate the function body in the **latest** migration that **`create or replace`**’s it (older files may show superseded prose).
- Reconstruct inputs that hit each **`raise_app_error`** branch; optional JSON in **`DETAIL`** appears as **`details`** on the client and in **`meta.pgDetail`** after mapping.

## 5. Client correlation

- Check **`operation`**, **`traceId`**, and **`formatTechnicalErrorSummary`** output (from **Teknik detay** in UI when enabled).
