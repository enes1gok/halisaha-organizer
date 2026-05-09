# Grup silme — staging / production doğrulama (SQL checklist)

`public.groups` satırının uygulama ile silinebilmesi için RLS politikasının (`groups_delete_owner`) hedef ortamda **uygulanmış** olması ve kayıt düzeyinde sahibin oturum kullanıcısıyla **eşleşmesi** gerekir.

**İlgili:** App Review test kullanıcısı için `owner_id` düzeltme playbook’u [group-ownership-review-account.md](./group-ownership-review-account.md); mağaza hesap bilgisi [app-review-test-account.md](./app-review-test-account.md).

## 1. Politikanın varlığı

Supabase SQL Editor veya `psql`:

```sql
select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'public.groups'::regclass
  and polname = 'groups_delete_owner';
```

Beklenen: `polcmd` = `d` (DELETE), `using_expr` içinde `owner_id = auth.uid()` benzeri ifade.

## 2. Belirli grup için sahip doğrulaması

`:group_id` ve `:session_user_id` yer tutucularını gerçek UUID’lerle değiştirin (`session_user_id` = Dashboard Auth kullanıcı id’si veya test JWT subject).

```sql
select id, name, owner_id
from public.groups
where id = :group_id::uuid;
```

- Silme **başarılı olmalıysa**: `owner_id` = oturum açan kullanıcının `auth.uid()` değeri.
- Uyumsuzluk varsa: veriyi düzeltin veya doğru hesapla test edin (istemci `NOT_FOUND` / yetki mesajı üretir).

## 3. Migration uygulama sırası

Proje migration’larında grup silme politikası:

- [`supabase/migrations/20260524120000_groups_delete_owner_rls.sql`](../supabase/migrations/20260524120000_groups_delete_owner_rls.sql)

Remote projede `supabase db push` / CI ile bu migration’ın uygulandığını doğrulayın.

## 4. Regresyon testi (yerel)

```bash
npm run test:rls:sql
```

[`supabase/tests/rls_groups.test.sql`](../supabase/tests/rls_groups.test.sql) üye silme / sahip silme davranışını kapsar.
