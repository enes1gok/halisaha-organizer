// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DEFAULT_DRAIN_LIMIT = 50;
const MAX_DRAIN_ITERATIONS = 10;

type DeliveryType =
  | 'initial'
  | 'reminder'
  | 'payment_reminder'
  | 'match_cancelled'
  | 'venue_change'
  | 'lineup_published'
  | 'post_match_rating_reminder'
  | 'match_result'
  | 'streak_at_risk'
  | 'payment_morning_reminder'
  | 'payment_unpaid_summary_organizer'
  | 'roster_full_organizer';

type ClaimedDeliveryRow = {
  delivery_id: string;
  delivery_token: string;
  match_id: string | null;
  group_id: string | null;
  recipient_id: string;
  delivery_type: DeliveryType;
  reminder_date: string | null;
  match_starts_at: string | null;
  match_venue: string | null;
  group_name: string | null;
  organizer_display_name: string | null;
  match_score_a: number | null;
  match_score_b: number | null;
};

type ClaimedDelivery = {
  id: string;
  token: string;
  match_id: string | null;
  group_id: string | null;
  recipient_id: string;
  type: DeliveryType;
  reminder_date: string | null;
  match_starts_at: string | null;
  match_venue: string | null;
  group_name: string | null;
  organizer_display_name: string | null;
  match_score_a: number | null;
  match_score_b: number | null;
};

type NotificationPreferences = {
  push_enabled?: boolean;
  types?: {
    group_match_initial?: boolean;
    group_match_reminder?: boolean;
    group_match_payment_reminder?: boolean;
    group_match_cancelled?: boolean;
    group_match_venue_change?: boolean;
    group_match_lineup_published?: boolean;
    group_match_post_match_rating_reminder?: boolean;
    group_match_match_result?: boolean;
    group_match_streak_at_risk?: boolean;
    group_match_payment_morning_reminder?: boolean;
    group_match_payment_unpaid_summary_organizer?: boolean;
    group_match_roster_full_organizer?: boolean;
  };
  quiet_hours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
};

function normalizeClaimed(row: ClaimedDeliveryRow): ClaimedDelivery {
  return {
    id: row.delivery_id,
    token: row.delivery_token,
    match_id: row.match_id,
    group_id: row.group_id,
    recipient_id: row.recipient_id,
    type: row.delivery_type,
    reminder_date: row.reminder_date ?? null,
    match_starts_at: row.match_starts_at ?? null,
    match_venue: row.match_venue ?? null,
    group_name: row.group_name ?? null,
    organizer_display_name: row.organizer_display_name ?? null,
    match_score_a: row.match_score_a ?? null,
    match_score_b: row.match_score_b ?? null,
  };
}

function asPrefs(raw: unknown): NotificationPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as NotificationPreferences;
}

const PREF_KEY_BY_DELIVERY_TYPE: Record<
  DeliveryType,
  keyof NonNullable<NotificationPreferences['types']>
> = {
  initial: 'group_match_initial',
  reminder: 'group_match_reminder',
  payment_reminder: 'group_match_payment_reminder',
  match_cancelled: 'group_match_cancelled',
  venue_change: 'group_match_venue_change',
  lineup_published: 'group_match_lineup_published',
  post_match_rating_reminder: 'group_match_post_match_rating_reminder',
  match_result: 'group_match_match_result',
  streak_at_risk: 'group_match_streak_at_risk',
  payment_morning_reminder: 'group_match_payment_morning_reminder',
  payment_unpaid_summary_organizer: 'group_match_payment_unpaid_summary_organizer',
  roster_full_organizer: 'group_match_roster_full_organizer',
};

/** Mirrors SQL `notification_delivery_allowed` + optional quiet-hours block at send time. */
function shouldSendPush(
  prefs: NotificationPreferences | null,
  type: DeliveryType,
  now: Date,
): { ok: boolean; reason?: 'preferences' | 'quiet_hours' } {
  const p = prefs;
  if (p?.push_enabled === false) return { ok: false, reason: 'preferences' };
  const key = PREF_KEY_BY_DELIVERY_TYPE[type];
  if (p?.types?.[key] === false) return { ok: false, reason: 'preferences' };

  const qh = p?.quiet_hours;
  if (qh?.enabled && isWithinQuietHours(now, qh)) {
    return { ok: false, reason: 'quiet_hours' };
  }
  return { ok: true };
}

function isActiveInApp(lastSeenAt: string | null, appState: string | null, now: Date): boolean {
  if (!lastSeenAt || appState !== 'foreground') return false;
  const parsed = Date.parse(lastSeenAt);
  if (Number.isNaN(parsed)) return false;
  return now.getTime() - parsed <= 90_000;
}

function parseMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isWithinQuietHours(
  now: Date,
  qh: { start?: string; end?: string; timezone?: string },
): boolean {
  const tz = qh.timezone?.trim() || 'Europe/Istanbul';
  const startStr = qh.start ?? '22:30';
  const endStr = qh.end ?? '07:00';
  const startM = parseMinutes(startStr);
  const endM = parseMinutes(endStr);
  if (startM === null || endM === null) return false;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((x) => x.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((x) => x.type === 'minute')?.value ?? 0);
  const cur = hour * 60 + minute;

  if (startM <= endM) {
    return cur >= startM && cur < endM;
  }
  return cur >= startM || cur < endM;
}

async function fetchNotificationPreferencesByUserIds(
  ids: string[],
): Promise<Map<string, NotificationPreferences | null>> {
  const map = new Map<string, NotificationPreferences | null>();
  for (const id of ids) map.set(id, null);
  const uniq = [...new Set(ids)].filter(Boolean);
  if (uniq.length === 0) return map;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, notification_preferences')
    .in('id', uniq);
  if (error) throw error;
  for (const row of data ?? []) {
    const r = row as { id: string; notification_preferences: unknown };
    map.set(r.id, asPrefs(r.notification_preferences));
  }
  return map;
}

async function fetchPresenceByUserIds(ids: string[]): Promise<Map<string, { active: boolean }>> {
  const map = new Map<string, { active: boolean }>();
  for (const id of ids) map.set(id, { active: false });
  const uniq = [...new Set(ids)].filter(Boolean);
  if (uniq.length === 0) return map;

  const { data, error } = await supabase
    .from('notification_presence')
    .select('user_id, app_state, last_seen_at')
    .in('user_id', uniq);
  if (error) throw error;

  const now = new Date();
  for (const row of data ?? []) {
    const r = row as { user_id: string; app_state: string | null; last_seen_at: string | null };
    map.set(r.user_id, { active: isActiveInApp(r.last_seen_at, r.app_state, now) });
  }
  return map;
}

const matchTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

function formatMatchTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return matchTimeFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function buildMessage(delivery: ClaimedDelivery): { title: string; body: string } {
  const groupName = delivery.group_name?.trim() ? delivery.group_name : 'Grubunuz';
  if (delivery.type === 'reminder') {
    const detail = [formatMatchTime(delivery.match_starts_at), delivery.match_venue ?? '']
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' • ');
    return {
      title: 'Halısaha hatırlatması',
      body: detail
        ? `${groupName} • ${detail} — RSVP'ni unutma`
        : `${groupName} grubu maçı için RSVP'ni unutma`,
    };
  }
  if (delivery.type === 'payment_reminder') {
    const detail = [formatMatchTime(delivery.match_starts_at), delivery.match_venue ?? '']
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' • ');
    return {
      title: 'Odeme hatirlatmasi',
      body: detail
        ? `${groupName} • ${detail} — Odemeni tamamlamayi unutma`
        : `${groupName} grubu maci icin odemeni tamamlamayi unutma`,
    };
  }
  if (delivery.type === 'match_cancelled') {
    return {
      title: 'Maç iptal edildi',
      body: `${groupName} grubundaki maç iptal edildi`,
    };
  }
  if (delivery.type === 'venue_change') {
    const venue = (delivery.match_venue ?? '').trim();
    const when = formatMatchTime(delivery.match_starts_at);
    const tail = [when, venue].filter(Boolean).join(' • ');
    return {
      title: 'Saha güncellendi',
      body: tail ? `${groupName} • ${tail}` : `${groupName} grubunda saha bilgisi güncellendi`,
    };
  }
  if (delivery.type === 'lineup_published') {
    const organizerLabel = (delivery.organizer_display_name ?? '').trim() || 'Organizatör';
    return {
      title: 'Kadro yayınlandı',
      body: `${organizerLabel} kadroyu yayınladı • ${groupName}`,
    };
  }
  if (delivery.type === 'post_match_rating_reminder') {
    return {
      title: 'Maç sonu oylaması hazır',
      body: `${groupName} maçında Maçın Adamı ve oyuncu puanlarını ver`,
    };
  }
  if (delivery.type === 'match_result') {
    const sa = delivery.match_score_a ?? 0;
    const sb = delivery.match_score_b ?? 0;
    return {
      title: 'Maç sonucu',
      body: `Maç Sonucu: ${sa}–${sb}`,
    };
  }
  if (delivery.type === 'streak_at_risk') {
    return {
      title: 'Haftalık serin tehlikede',
      body: 'Bu hafta grubunda planlı maç yok — seriyi korumak için bir maç ayarla.',
    };
  }
  if (delivery.type === 'payment_morning_reminder') {
    const detail = [delivery.match_venue ?? '', formatMatchTime(delivery.match_starts_at)]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' • ');
    return {
      title: 'Bugün maç var',
      body: detail
        ? `${groupName} • ${detail} — nakit/notu unutma`
        : `${groupName} grubunda bugün maç var — nakit/notu unutma`,
    };
  }
  if (delivery.type === 'payment_unpaid_summary_organizer') {
    return {
      title: 'Ödenmemiş katılımcılar',
      body: `${groupName} maçında henüz ödemesini yapmayan katılımcılar var`,
    };
  }
  if (delivery.type === 'roster_full_organizer') {
    const detail = [delivery.match_venue ?? '', formatMatchTime(delivery.match_starts_at)]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' • ');
    return {
      title: 'Kadro doldu',
      body: detail
        ? `${groupName} • ${detail} — kadro tamamlandı`
        : `${groupName} grubundaki maçın kadrosu tamamlandı`,
    };
  }
  return {
    title: 'Yeni grup maçı',
    body: `${groupName} grubunda yeni maç açıldı`,
  };
}

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default', data }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo push failed: ${response.status} ${text}`);
  }
}

async function markSent(deliveryId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_deliveries')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      error_message: null,
      claimed_at: null,
    })
    .eq('id', deliveryId);
  if (error) throw error;
}

async function markInApp(deliveryId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_deliveries')
    .update({
      status: 'in_app',
      sent_at: new Date().toISOString(),
      error_message: 'routed: active_in_app',
      claimed_at: null,
    })
    .eq('id', deliveryId);
  if (error) throw error;
}

async function markFailed(deliveryId: string, message: string): Promise<void> {
  await supabase
    .from('notification_deliveries')
    .update({
      status: 'failed',
      error_message: message.slice(0, 500),
      claimed_at: null,
    })
    .eq('id', deliveryId);
}

type ProcessOutcome = 'sent' | 'skipped' | 'failed' | 'in_app';

async function processClaimed(
  delivery: ClaimedDelivery,
  prefMap: Map<string, NotificationPreferences | null>,
  presenceMap: Map<string, { active: boolean }>,
  now: Date,
): Promise<ProcessOutcome> {
  if (presenceMap.get(delivery.recipient_id)?.active) {
    await markInApp(delivery.id);
    return 'in_app';
  }

  const prefs = prefMap.get(delivery.recipient_id) ?? null;
  const gate = shouldSendPush(prefs, delivery.type, now);
  if (!gate.ok) {
    const msg =
      gate.reason === 'quiet_hours' ? 'skipped: quiet hours' : 'skipped: notification preferences';
    await markFailed(delivery.id, msg);
    return 'skipped';
  }

  try {
    const { title, body } = buildMessage(delivery);
    const target = delivery.type === 'streak_at_risk' ? 'profile' : 'matchDetail';
    await sendExpoPush(delivery.token, title, body, {
      ...(delivery.match_id ? { matchId: delivery.match_id } : {}),
      ...(delivery.group_id ? { groupId: delivery.group_id } : {}),
      type: delivery.type,
      target,
    });
    await markSent(delivery.id);
    return 'sent';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    await markFailed(delivery.id, message);
    return 'failed';
  }
}

async function drainPending(
  limit: number,
): Promise<{ processed: number; failed: number; skipped: number; inApp: number; iterations: number }> {
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  let inApp = 0;
  let iterations = 0;

  while (iterations < MAX_DRAIN_ITERATIONS) {
    iterations += 1;
    const { data, error } = await supabase.rpc('claim_pending_deliveries', { p_limit: limit });
    if (error) throw error;
    const claimed = ((data ?? []) as ClaimedDeliveryRow[]).map(normalizeClaimed);
    if (claimed.length === 0) break;

    const ids = claimed.map((c) => c.recipient_id);
    const prefMap = await fetchNotificationPreferencesByUserIds(ids);
    const presenceMap = await fetchPresenceByUserIds(ids);
    const now = new Date();

    const results = await Promise.all(
      claimed.map((row) => processClaimed(row, prefMap, presenceMap, now)),
    );
    for (const outcome of results) {
      if (outcome === 'sent') processed += 1;
      else if (outcome === 'skipped') skipped += 1;
      else if (outcome === 'in_app') inApp += 1;
      else failed += 1;
    }
    if (claimed.length < limit) break;
  }

  return { processed, failed, skipped, inApp, iterations };
}

async function fetchSingleDelivery(deliveryId: string): Promise<ClaimedDelivery | null> {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select(
      `id, token, match_id, group_id, recipient_id, type, reminder_date,
       match:matches(
         starts_at,
         venue,
         score_a,
         score_b,
         organizer:profiles!matches_organizer_id_fkey(display_name)
       ),
       group:groups(name)`,
    )
    .eq('id', deliveryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const match = (data as any).match as {
    starts_at: string | null;
    venue: string | null;
    score_a: number | null;
    score_b: number | null;
    organizer: { display_name: string | null } | null;
  } | null;
  const group = (data as any).group as { name: string | null } | null;

  return {
    id: (data as any).id,
    token: (data as any).token,
    match_id: (data as any).match_id,
    group_id: (data as any).group_id,
    recipient_id: (data as any).recipient_id,
    type: (data as any).type as DeliveryType,
    reminder_date: (data as any).reminder_date ?? null,
    match_starts_at: match?.starts_at ?? null,
    match_venue: match?.venue ?? null,
    group_name: group?.name ?? null,
    organizer_display_name: match?.organizer?.display_name ?? null,
    match_score_a: match?.score_a ?? null,
    match_score_b: match?.score_b ?? null,
  };
}

async function processSingle(
  deliveryId: string,
): Promise<{ processed: number; failed: number; skipped: number; inApp: number }> {
  const delivery = await fetchSingleDelivery(deliveryId);
  if (!delivery) return { processed: 0, failed: 0, skipped: 0, inApp: 0 };
  const prefMap = await fetchNotificationPreferencesByUserIds([delivery.recipient_id]);
  const presenceMap = await fetchPresenceByUserIds([delivery.recipient_id]);
  const outcome = await processClaimed(delivery, prefMap, presenceMap, new Date());
  if (outcome === 'sent') return { processed: 1, failed: 0, skipped: 0, inApp: 0 };
  if (outcome === 'skipped') return { processed: 0, failed: 0, skipped: 1, inApp: 0 };
  if (outcome === 'in_app') return { processed: 0, failed: 0, skipped: 0, inApp: 1 };
  return { processed: 0, failed: 1, skipped: 0, inApp: 0 };
}

Deno.serve(async (req) => {
  try {
    let body: { mode?: string; deliveryId?: string; limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const wantsDrain = body.mode === 'drain' || (!body.mode && !body.deliveryId);
    if (wantsDrain) {
      const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_DRAIN_LIMIT, 1), 500);
      const result = await drainPending(limit);
      return new Response(JSON.stringify({ ok: true, mode: 'drain', ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.deliveryId) {
      const result = await processSingle(body.deliveryId);
      return new Response(JSON.stringify({ ok: true, mode: 'single', ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'mode veya deliveryId gerekli' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
