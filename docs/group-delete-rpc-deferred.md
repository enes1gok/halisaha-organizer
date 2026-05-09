# Grup silme RPC (`delete_group`) — ürün kararı (ertelenmiş)

## Durum

Şu an grup silme **istemci** üzerinden `DELETE` + `fetchMyGroups` ile reconcile edilerek yapılıyor; RLS (`groups_delete_owner`) yetkiyi zorlar.

## İsteğe bağlı Supabase RPC

İleride aşağıdaki durumlarda `public.delete_group(p_group_id uuid)` gibi bir RPC düşünülebilir:

- DELETE sonrası boş sonuç ile **yetkisiz** / **bulunamadı** ayrımını tek bir `ERR_*` ile döndürmek
- Çok tablolu ek yan etkiler tek atomik işlemde toplansın

## Karar

Bu repoda **zorunlu değildir**; müşteri/iş gereksinimi ve ürün önceliği ile yeniden değerlendirilir. Uygulama kılavuzu: [`.cursor/skills/add-atomic-rpc/SKILL.md`](../.cursor/skills/add-atomic-rpc/SKILL.md).
