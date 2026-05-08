---
name: add-notification-flow
description: >-
  End-to-end guide for adding a new push delivery type: trigger choice, notification_deliveries
  enqueue SQL, Edge Function buildMessage/shouldSendPush, and pgTAP. Use when extending the
  group match notification pipeline, notification_deliveries types, or supabase/functions push workers.
---

# Add notification flow (push pipeline)

Use this skill when adding or changing **typed** rows in `notification_deliveries`, enqueue/drain behavior, or the **group-match** notification Edge Function. Authoritative rules: [`notification-governance.mdc`](../../rules/notification-governance.mdc).

## 1. Tetikleyici tanımı

- **Ne zaman?** `INSERT` / `UPDATE` (hangi kolonlar) / `pg_cron` (ör. günlük hatırlatıcı) / başka.
- **Kimler?** `recipient_id` + `push_tokens` join kuralları (grup üyesi, RSVP, organizer hariç mi, vb.).
- **Idempotency / tekrar:** Kuyruk satırı aynı olay için iki kez yazılmamalı; gerekirse `ON CONFLICT` + partial unique index. Cron veya retry ile **güvenli** olması gerekiyorsa [`refactor-to-idempotent-logic`](../refactor-to-idempotent-logic/SKILL.md).

## 2. Kuyruk kaydı (Postgres)

- `notification_deliveries.type`: yeni değer eklerken **`notification_deliveries_type_check`** migration’da güncellenir.
- **`reminder_date`:** [`notification_deliveries_reminder_date_chk`](../../../supabase/migrations/20260512120000_group_match_rsvp_reminders.sql) — `reminder` dışındaki tiplerde genelde `reminder_date IS NULL`.
- **Kullanıcıya metin yok:** Satırda title/body tutulmaz; yalnızca yönlendirme gerçekleri (match_id, group_id, recipient_id, token, type, …).
- **Partial unique:** `reminder` ve `initial` ile aynı desen; yeni tip için tekrarları önleyen index (gerekiyorsa).
- **Enqueue fonksiyonu / trigger:** `SECURITY DEFINER`, `set search_path = public`, grant/revoke [`security_linter_hardening`](../../../supabase/migrations/20260514120000_security_linter_hardening.sql) ile uyumlu.
- **Tercihler:** `public.notification_delivery_allowed(p_prefs, '<delivery_kind>')` ve profil `types.*` anahtarları; Edge’deki `shouldSendPush` ile aynı isimlendirme.

## 3. Edge Function güncellemesi

- Dosya: [`supabase/functions/group-match-created/index.ts`](../../../supabase/functions/group-match-created/index.ts).
- `DeliveryType` (veya eşdeğeri), `buildMessage`, `NotificationPreferences.types`, `shouldSendPush` içinde yeni anahtar.
- **Quiet hours:** Varsayılan olarak mevcut kapı korunur; “kritik” bypass için ürün/güvenlik onayı gerekir ([`notification-governance.mdc`](../../rules/notification-governance.mdc)).

## 4. Test (pgTAP)

- [`supabase/tests/`](../../../supabase/tests/) — mevcut dosyaları genişlet veya `notification_*.test.sql` ekle.
- Doğrula: enqueue sayıları, tercih kapalıyken satır yok, iptal/temizlik gibi çok adımlı senaryolar.
- Komut: projede tanımlı SQL test komutu (ör. `npm run test:rls:sql` / `supabase test db`); detay [`supabase-governance`](../supabase-governance/SKILL.md).

## İlgili

- [`notification-governance.mdc`](../../rules/notification-governance.mdc) — CHECK, dedup index, SD fonksiyonlar
- [`add-atomic-rpc`](../add-atomic-rpc/SKILL.md) — çok tablolu atomik yazma gerekiyorsa
