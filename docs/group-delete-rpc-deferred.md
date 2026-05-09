# Grup silme RPC (`delete_group`) — uygulandı

## Durum

Grup silme artık **`public.delete_group(p_group_id uuid)`** RPC ile yapılıyor; istemci doğrudan `DELETE` + reconcile kullanmıyor. Böylece RLS’nin PostgREST üzerindeki “sessiz 0 satır” davranışı ile karışan **yetkisiz / bulunamadı** durumları ayırt edilir.

## Kontrat

| Öğe | Değer |
|-----|-----|
| Fonksiyon | `public.delete_group(p_group_id uuid) returns uuid` |
| Güvenlik | `SECURITY DEFINER`, `SET search_path = public` |
| Grant | `EXECUTE` → `authenticated` |
| Başarı | Silinen grubun `id` döner |
| `ERR_AUTH_REQUIRED` | Oturum yok (`auth.uid()` null) |
| `ERR_GROUP_NOT_FOUND` | Satır yok veya ikinci silme denemesi |
| `ERR_GROUP_DELETE_FORBIDDEN` | Satır var ancak `owner_id <> auth.uid()` |

Migration: [`supabase/migrations/20260527120000_delete_group_rpc.sql`](../supabase/migrations/20260527120000_delete_group_rpc.sql).

RLS politikası `groups_delete_owner` korunur (doğrudan tablo erişimi için savunma katmanı).

## İstemci

- Servis: [`src/services/supabase/groups.ts`](../src/services/supabase/groups.ts) — `supabase.rpc('delete_group', { p_group_id })`, `traceId` + `requestPayload`.
- Use case: [`src/usecases/groups.ts`](../src/usecases/groups.ts).

## Testler

- pgTAP: [`supabase/tests/rpc_delete_group.test.sql`](../supabase/tests/rpc_delete_group.test.sql)
- Jest: `src/usecases/__tests__/groups.delete.test.ts`

## İlgili

- Atomik RPC kalıbı: [`.cursor/skills/add-atomic-rpc/SKILL.md`](../.cursor/skills/add-atomic-rpc/SKILL.md)
