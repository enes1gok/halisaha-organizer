# Notification governance

Apply this rule when changing the push delivery pipeline: `notification_deliveries`, enqueue/drain RPCs and triggers, or the notification Edge Function (e.g. [supabase/functions/group-match-created/index.ts](../../supabase/functions/group-match-created/index.ts)).

## A. Notification-first design

- **Typed deliveries:** The `type` column is `text` validated by **`notification_deliveries_type_check`** (not a separate Postgres enum). For every new delivery kind, update that CHECK constraint in a migration, align Edge types (e.g. `DeliveryType`) and send logic, and extend pgTAP coverage ([supabase/tests/notification_reminders.test.sql](../../supabase/tests/notification_reminders.test.sql), [supabase/tests/notification_cancel_venue.test.sql](../../supabase/tests/notification_cancel_venue.test.sql), and related tests).
- **No user-facing copy in the database:** Store only scheduling and routing facts — who, when, and with what keys (`match_id`, `group_id`, `recipient_id`, `token`, `type`, `reminder_date`, etc.). Build titles/bodies at the Edge Function (future i18n lives there or in a shared translation layer used by Edge — not in SQL row payloads).
- **Quiet hours:** Non-critical pushes must respect the Edge Function gate (`shouldSendPush` → `isWithinQuietHours`). Defaults match **22:30–07:00** in **`Europe/Istanbul`** when user prefs omit overrides; users may customize via `profiles.notification_preferences.quiet_hours`. Today all handled delivery types use the same gate; introducing a "critical" class that bypasses quiet hours requires an explicit product/security decision and code review.

## B. Data integrity

- **One reminder per day per target:** Keep the partial unique index **`notification_deliveries_unique_reminder`** on `(match_id, recipient_id, token, reminder_date)` where `type = 'reminder'` ([20260512120000_group_match_rsvp_reminders.sql](../../supabase/migrations/20260512120000_group_match_rsvp_reminders.sql)). Do not drop or weaken it without replacing the same dedup guarantee.
- **Enqueue functions:** Any function that inserts into `notification_deliveries` (triggers or RPCs such as **`enqueue_group_match_notifications`**, **`enqueue_group_match_reminders`**) must be **`security definer`** with an explicit **`set search_path = public`**, and grants must stay aligned with [supabase/migrations/20260514120000_security_linter_hardening.sql](../../supabase/migrations/20260514120000_security_linter_hardening.sql) (or successor migrations).

## C. Channel arbitration policy (global)

- **Active user routing:** If recipient presence is fresh and `foreground`, route to **in-app banner** and suppress push send. This rule applies to all delivery types (`initial`, `reminder`, `payment_reminder`, `match_cancelled`, `venue_change`, `lineup_published`) unless product/security explicitly approves an exception.
- **Send-time decision point:** Final channel arbitration must happen in the Edge send worker so presence can be evaluated with current state immediately before delivery.
- **Stale window contract:** Presence freshness uses a bounded window (currently 90 seconds). Missing/stale presence falls back to normal push gate (preferences + quiet hours).
- **Status semantics:** In-app routing must be observable and distinct from push failure (`failed`). Do not overload failure statuses for intentional channel routing.
- **Client responsibility:** App foreground/background transitions must upsert presence and render in-app banners for rows routed to `in_app`.

## Review checklist

```
- [ ] New `type` values: CHECK constraint + Edge types/logic + pgTAP updates
- [ ] No push title/body stored on notification_deliveries rows
- [ ] Quiet-hour behavior unchanged or intentionally documented for new kinds
- [ ] Send-time channel arbitration honors fresh foreground presence before push send
- [ ] In-app routing uses dedicated status/reason (not push-failed)
- [ ] Reminder dedup index preserved unless equivalent constraint replaces it
- [ ] New enqueue paths use security definer + fixed search_path + correct grants
```

## Related

- [supabase-governance.md](supabase-governance.md) — RLS, migrations, privileged roles
- [supabase-schema-evolution.md](supabase-schema-evolution.md) — DDL conventions
- [atomic-mutation-policy.md](atomic-mutation-policy.md) — multi-table atomic writes where relevant
- [../skills/add-notification-flow.md](../skills/add-notification-flow.md) — end-to-end workflow for new delivery types
