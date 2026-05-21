# Supabase governance

> **Policy reference.** For the task workflow (RLS playbooks, test commands, CI): [../skills/supabase-governance.md](../skills/supabase-governance.md).

Apply this rule whenever a task touches Supabase auth, database, RLS policies, migrations, storage access, or server-side Supabase clients.

## Security guardrails

- **RLS first:** Enable RLS on exposed schemas (especially `public`) and define explicit policies per role (`anon`, `authenticated`, `service_role`).
- **Do not authorize with `user_metadata`:** Authorization claims must come from trusted server-managed data (`app_metadata` or database relations), not user-editable metadata.
- **No `service_role` in clients:** Never expose `service_role` or secret keys in mobile/web bundles or public env vars.
- **View and function safety:** Use `security_invoker` views where possible; keep `security definer` functions in private schemas.
- **Policy completeness:** Remember `UPDATE` needs a matching `SELECT` policy; otherwise updates silently affect 0 rows.
- **Storage upsert permissions:** If using upsert, ensure policy set covers `INSERT`, `SELECT`, and `UPDATE`.

## Schema and migration workflow

- **Migration-first DDL:** Schema changes must be committed as migrations; avoid one-off manual changes in production.
- **Idempotent SQL mindset:** Prefer statements that are safe to re-run (`IF EXISTS`, `IF NOT EXISTS`) when appropriate.
- **Descriptive migration names:** Use migration names that explain intent (feature or bugfix), not generic timestamps alone.

## Migration deployment (Claude'un sorumluluğu)

`supabase/migrations/` altında herhangi bir dosya yazıldıktan veya değiştirildikten sonra Claude aşağıdaki adımları **otomatik olarak** çalıştırır — kullanıcıdan bu adımları yapmasını asla istemez.

> **Çoklu migration:** Aynı task içinde birden fazla migration dosyası yazılıyorsa `db reset` ve `db push` her dosya sonrasında değil, **tüm dosyalar yazıldıktan sonra tek seferde** çalıştırılır.

### Zorunlu adımlar

1. **Lokal stack kontrolü.**
   `npx supabase status` çalıştır. Stack çalışmıyorsa 2. adımı atla, direkt 3. adıma geç (bunu response'da belirt).

2. **Lokal uygulama** *(yalnızca stack çalışıyorsa).*
   `npx supabase db reset` çalıştır. Tüm migration'lar (yeni dahil) lokal stack'e uygulanır.
   - Başarısız olursa: **dur**, hata çıktısını olduğu gibi raporla, remote push'a geçme. SQL'i düzelt, tekrar dene.

3. **Remote push.**
   `npx supabase db push` çalıştır.
   - Başarısız olursa: tam hata çıktısını raporla; suppress etme, summarize etme. Proje link edilmemişse `npx supabase link` hatırlatmasını yap.

4. **Doğrulama.**
   `npx supabase migration list --linked` çalıştır. Yeni migration'ın "applied" listesinde göründüğünü doğrula ve sonucu response'da raporla.

### Kesin yasaklar

- Kullanıcıya "siz `db push` çalıştırmalısınız" veya herhangi bir varyasyonunu **asla** söyleme.
- Push'u "sadece fonksiyon eklendi" / "sadece index" diye atlama — tüm DDL mutlaka uygulanmalı.
- `db push` hatasını gizleme veya özetleme; tam CLI çıktısı gösterilmeli.
- `db reset` başarısız olduğunda remote'a push yapma.

### Hata tablosu

| Hata | Claude'un yapacağı |
|------|-------------------|
| Stack çalışmıyor | `db reset` atla, `db push` yap, lokal adımın atlandığını belirt |
| `db reset` SQL hatası | Migration SQL'ini düzelt, `db reset` tekrar çalıştır, sonra push |
| `db push` — proje link yok | Tam çıktıyı raporla + `npx supabase link` hatırlatması yap |
| `db push` — remote SQL hatası | Tam çıktıyı raporla; otomatik workaround deneme |
| `migration list --linked` migration'ı göstermiyor | "Remote state uncertain" uyarısı ver, tam listeyi raporla |

## Operational checklist

- **Pre-merge checks:** Run advisor/performance/security checks before shipping database-affecting changes.
- **Client/RPC sync gate:** Before merging any change that adds or renames a `supabase.rpc()` name or its parameters in `src/services/supabase/`, verify the matching migration is applied on the target Supabase project (`list_migrations` + `pg_proc` lookup). Mismatch causes `PGRST202` "function not found in schema cache" at runtime even though local migrations look complete.
- **Post-change verification:** Validate critical queries and authorization paths with smoke tests after schema/policy changes.
- **Incident response:** For auth/RLS regressions, inspect logs first, isolate policy scope, and apply minimal corrective changes.

## Review checklist

```
- [ ] RLS enabled on exposed tables
- [ ] Policies match intended role access model
- [ ] No client exposure of privileged Supabase keys
- [ ] Migrations are descriptive and reviewable
- [ ] Critical auth + query paths verified after change
- [ ] Every supabase.rpc() called by the client exists with the same signature on the deployed Supabase project (PGRST202 guard)
```

## RLS automated tests (repo)

- **pgTAP (SQL):** `supabase/tests/*.sql` — policy matrix against `authenticated` / `anon` using `tests.*` helpers in [supabase/tests/000_helpers.sql](../../supabase/tests/000_helpers.sql). Run: `npm run test:rls:sql` (requires Supabase CLI and `supabase start` / CI stack).
- **Jest integration:** [src/services/supabase/__tests__/rls/](../../src/services/supabase/__tests__/rls/) — real `anon` + signed-in clients and RPCs. Requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (e.g. `eval "$(supabase status -o env)"` then map to those names). Run: `npm run test:rls:integration` or `npm run test:rls` after SQL tests.
- **CI:** [.github/workflows/supabase-rls.yml](../../.github/workflows/supabase-rls.yml) runs `supabase db reset`, `supabase test db`, then Jest with keys from `supabase status -o env`.
- **Service role:** Only in test/CI env for `auth.admin` and optional `FORCE_DB_RESET=1` local resets — never in Expo client env.
