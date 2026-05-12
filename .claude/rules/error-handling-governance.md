# Error handling governance

## Postgres / RPC

- Prefer **`public.raise_app_error(p_token text, p_payload jsonb default '{}')`** (see migration `raise_app_error_protocol`) instead of ad-hoc `raise exception '...'` prose. Message body stays a stable **`ERR_*`** token; optional structured fields go in **`DETAIL`** as JSON (`p_payload`).
- Authorization for match mutations should continue to use helpers such as **`public.is_match_organizer`** (and related helpers) rather than duplicating policy logic in prose errors.
- New **`ERR_*`** tokens require a 4-step update:
  1. Add the token string to the Postgres `ERR_REGISTRY` constant in the migration (see the `raise_app_error_protocol` migration for format).
  2. Add the corresponding key to the **`ErrorTranslationKey`** union in [src/i18n/errorTranslationKeys.ts](../../src/i18n/errorTranslationKeys.ts).
  3. Add the Turkish string (with any interpolation slots) to [src/i18n/locales/tr/errors.ts](../../src/i18n/locales/tr/errors.ts).
  4. The key is automatically resolved via [src/i18n/translateError.ts](../../src/i18n/translateError.ts) — no further wiring required.

## Client services

- Every Supabase error surfaced to UI should pass through **`mapSupabaseError`** with a **stable, unique `operation`** string (e.g. `fetchMatchGraph.attendees`, `submitMatchResultRpc`).
- Critical mutations may pass **`MapSupabaseErrorOptions`**: **`traceId`** (from **`generateTraceId()`**) and a **whitelist** **`requestPayload`** (ids, counts — never JWTs or raw profile blobs).

## Logging / UI

- Use **`reportError`** from `src/services/logging/reportError.ts` for centralized dev logging; extend later for Sentry etc. without duplicating PII.
- **In-app feedback:** Prefer **`useUserFeedback()`** / **`showApiErrorToast`**, **`showValidationToast`**, and **`showUserFacingError`** ([src/utils/userFeedback.ts](../../src/utils/userFeedback.ts)) so messages appear in **`ToastHost`** instead of blocking **`Alert.alert`**. Reserve **`Alert.alert`** for destructive confirmations (silme, iptal, gruptan ayrılma, vb.) or flows that require multiple explicit branches (ör. e-posta doğrulanmadı diyalogu).
- **`showUserFacingError`** (exported from [src/components/UserFacingErrorAlert.tsx](../../src/components/UserFacingErrorAlert.tsx)) surfaces **`formatTechnicalErrorSummary`** via toast action **Teknik detay** (kopyalama ikinci sistem diyalogunda).

## Related

- Atomic writes: [atomic-mutation-policy.md](atomic-mutation-policy.md)
- Supabase security: [supabase-governance.md](supabase-governance.md)
