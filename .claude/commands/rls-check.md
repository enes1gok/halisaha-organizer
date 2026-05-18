---
name: rls-check
description: Supabase RLS politikalarını yerel stack üzerinde hızlı doğrula
---

# RLS Doğrulama

Yeni bir tablo veya politika ekledikten sonra RLS güvenliğini test et.

## Ön Koşul

```bash
npx supabase start        # yerel stack çalışıyor olmalı
npx supabase db reset     # en güncel migration'lar uygulanmış olmalı
```

## SQL Test Çalıştır

```bash
npm run test:rls:sql
```

pgTAP testleri `supabase/tests/*.sql` altındaki tüm policy matrisini çalıştırır.

## Jest Entegrasyon Testi

```bash
eval "$(npx supabase status -o env)"
export SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
npm run test:rls:integration
```

## Tam RLS Suite

```bash
npm run test:rls
```

## Elle Kontrol Listesi

Yeni tablo/politika için:

- [ ] RLS `ENABLE ROW LEVEL SECURITY` var mı?
- [ ] `anon` erişimi açıkça kapatıldı mı?
- [ ] `authenticated` SELECT/INSERT/UPDATE/DELETE politikaları doğru mu?
- [ ] UPDATE politikası varsa eşleşen SELECT politikası da var mı?
- [ ] `service_role` bypass davranışı beklenen mi?
- [ ] Multi-table RPC `SECURITY DEFINER` + `set search_path = public` kullanıyor mu?

## Hızlı Policy Kontrol (SQL)

```sql
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

## İlgili

- [supabase-governance.md](../rules/supabase-governance.md)
- [supabase/tests/000_helpers.sql](../../supabase/tests/000_helpers.sql)
