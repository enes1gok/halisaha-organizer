---
name: add-notification-flow
description: Yeni push delivery tipi için uçtan uca rehber — tetikleyici seçimi, notification_deliveries kuyruğu SQL, Edge Function buildMessage/shouldSendPush ve pgTAP. Grup maçı bildirim pipeline'ını, notification_deliveries tiplerini veya supabase/functions push worker'larını genişletirken kullan.
---

# Add notification flow (push pipeline)

Use this skill when adding or changing **typed** rows in `notification_deliveries`, enqueue/drain behavior, or the **group-match** notification Edge Function. Authoritative rules: [.claude/rules/notification-governance.md](.claude/rules/notification-governance.md).

## 1. Tetikleyici tanımı

- **Ne zaman?** `INSERT` / `UPDATE` (hangi kolonlar) / `pg_cron` (ör. günlük hatırlatıcı) / başka.
- **Kimler?** `recipient_id` + `push_tokens` join kuralları (grup üyesi, RSVP, organizer hariç mi, vb.).
- **Idempotency / tekrar:** Kuyruk satırı aynı olay için iki kez yazılmamalı; gerekirse `ON CONFLICT` + partial unique index. Cron veya retry ile **güvenli** olması gerekiyorsa [.claude/skills/refactor-to-idempotent-logic.md](.claude/skills/refactor-to-idempotent-logic.md).

## 2. Kuyruk kaydı (Postgres)

- `notification_deliveries.type`: yeni değer eklerken **`notification_deliveries_type_check`** migration'da güncellenir.
- **`reminder_date`:** [`notification_deliveries_reminder_date_chk`](../../supabase/migrations/20260512120000_group_match_rsvp_reminders.sql) — `reminder` dışındaki tiplerde genelde `reminder_date IS NULL`.
- **Kullanıcıya metin yok:** Satırda title/body tutulmaz; yalnızca yönlendirme gerçekleri (match_id, group_id, recipient_id, token, type, …).
- **Partial unique:** `reminder` ve `initial` ile aynı desen; yeni tip için tekrarları önleyen index (gerekiyorsa).
- **Enqueue fonksiyonu / trigger:** `SECURITY DEFINER`, `set search_path = public`, grant/revoke [`security_linter_hardening`](../../supabase/migrations/20260514120000_security_linter_hardening.sql) ile uyumlu.
- **Tercihler:** `public.notification_delivery_allowed(p_prefs, '<delivery_kind>')` ve profil `types.*` anahtarları; Edge'deki `shouldSendPush` ile aynı isimlendirme.

## 3. Edge Function güncellemesi

- Dosya: [supabase/functions/group-match-created/index.ts](../../supabase/functions/group-match-created/index.ts).
- `DeliveryType` (veya eşdeğeri), `buildMessage`, `NotificationPreferences.types`, `shouldSendPush` içinde yeni anahtar.
- **Quiet hours:** Varsayılan olarak mevcut kapı korunur; "kritik" bypass için ürün/güvenlik onayı gerekir ([.claude/rules/notification-governance.md](.claude/rules/notification-governance.md)).

## 4. Test (pgTAP)

- [supabase/tests/](../../supabase/tests/) — mevcut dosyaları genişlet veya `notification_*.test.sql` ekle.
- Doğrula: enqueue sayıları, tercih kapalıyken satır yok, iptal/temizlik gibi çok adımlı senaryolar.
- Komut: projede tanımlı SQL test komutu (ör. `npm run test:rls:sql` / `supabase test db`); detay [.claude/skills/supabase-governance.md](.claude/skills/supabase-governance.md).

## İlgili

- [.claude/rules/notification-governance.md](.claude/rules/notification-governance.md) — CHECK, dedup index, SD fonksiyonlar
- [.claude/skills/add-atomic-rpc.md](.claude/skills/add-atomic-rpc.md) — çok tablolu atomik yazma gerekiyorsa
