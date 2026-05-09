# Grup silme — staging / production doğrulama (SQL checklist)

`public.groups` satırının uygulama ile silinebilmesi için `delete_group` RPC’sinin deploy edilmiş olması, RLS politikasının (`groups_delete_owner`) hedef ortamda **uygulanmış** olması ve kayıt düzeyinde sahibin oturum kullanıcısıyla **eşleşmesi** gerekir.

Hızlı teşhis (tek dosyada owner, politika, maç FK): [scripts/diagnose-group-delete.sql](../scripts/diagnose-group-delete.sql).

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
- Uyumsuzluk varsa: veriyi düzeltin veya doğru hesapla test edin (istemci `ERR_GROUP_DELETE_FORBIDDEN` veya `ERR_GROUP_NOT_FOUND` gösterir).

## 3. Migration uygulama sırası

Proje migration’larında grup silme:

- RLS DELETE (sahip): [`supabase/migrations/20260524120000_groups_delete_owner_rls.sql`](../supabase/migrations/20260524120000_groups_delete_owner_rls.sql)
- RPC: [`supabase/migrations/20260527120000_delete_group_rpc.sql`](../supabase/migrations/20260527120000_delete_group_rpc.sql)

Remote projede `supabase db push` / CI ile bu migration’ların uygulandığını doğrulayın.

## 4. Regresyon testi (yerel)

```bash
npm run test:rls:sql
```

[`supabase/tests/rls_groups.test.sql`](../supabase/tests/rls_groups.test.sql) üye silme / sahip silme davranışını kapsar. [`supabase/tests/rpc_delete_group.test.sql`](../supabase/tests/rpc_delete_group.test.sql) `delete_group` RPC’sini kapsar.

## 5. PGRST202 alıyorsanız (`function not found in schema cache`)

İstemcide hata `code: UNKNOWN`, `pgCode: PGRST202`, `errToken: ERR_BACKEND_SCHEMA_OUTDATED`, `rpcName: delete_group` görünüyorsa **uzak projede `public.delete_group(uuid)` fonksiyonu yok** demektir. Adım adım:

1. **Doğru projeye bağlısınız mı?**
   ```bash
   supabase status
   supabase projects list
   ```
   Çalışmadan önce `supabase link --project-ref <ref>` ile hedef projeye bağlanın.

2. **Migration listesi karşılaştırması** (uzak ile yerel arasında fark var mı):
   ```bash
   supabase migration list --linked
   ```
   `20260527120000_delete_group_rpc` satırının `Remote` kolonunda görünmesi gerekir.

3. **Fonksiyon var mı?** (Dashboard SQL Editor):
   ```sql
   select n.nspname  as schema,
          p.proname  as function_name,
          pg_get_function_identity_arguments(p.oid) as args,
          p.prosecdef as security_definer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'delete_group';
   ```
   Beklenen: tek satır; `args = 'p_group_id uuid'`, `security_definer = true`.

4. **Migration'ı uygula**:
   ```bash
   supabase db push
   ```
   Veya Dashboard → SQL Editor üzerinden [`supabase/migrations/20260527120000_delete_group_rpc.sql`](../supabase/migrations/20260527120000_delete_group_rpc.sql) içeriğini çalıştırın.

5. **PostgREST şema önbelleği**: deploy sonrasında çoğu durumda otomatik tazelenir. Hata sürerse Dashboard → Database → API → "Reload schema cache" tetikleyin.

6. **Doğrulama**: uygulamadan grup silme tekrar denenir. Beklenen: ya başarılı silme ya da `ERR_GROUP_NOT_FOUND` / `ERR_GROUP_DELETE_FORBIDDEN`. PGRST202 bir daha çıkmamalı.
