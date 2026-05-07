// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DEFAULT_DRAIN_LIMIT = 50;
const MAX_DRAIN_ITERATIONS = 10;

type DeliveryType = 'initial' | 'reminder';

type ClaimedDeliveryRow = {
  delivery_id: string;
  delivery_token: string;
  match_id: string;
  group_id: string;
  delivery_type: DeliveryType;
  reminder_date: string | null;
  match_starts_at: string | null;
  match_venue: string | null;
  group_name: string | null;
};

type ClaimedDelivery = {
  id: string;
  token: string;
  match_id: string;
  group_id: string;
  type: DeliveryType;
  reminder_date: string | null;
  match_starts_at: string | null;
  match_venue: string | null;
  group_name: string | null;
};

function normalizeClaimed(row: ClaimedDeliveryRow): ClaimedDelivery {
  return {
    id: row.delivery_id,
    token: row.delivery_token,
    match_id: row.match_id,
    group_id: row.group_id,
    type: row.delivery_type,
    reminder_date: row.reminder_date ?? null,
    match_starts_at: row.match_starts_at ?? null,
    match_venue: row.match_venue ?? null,
    group_name: row.group_name ?? null,
  };
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

async function processClaimed(delivery: ClaimedDelivery): Promise<boolean> {
  try {
    const { title, body } = buildMessage(delivery);
    await sendExpoPush(delivery.token, title, body, {
      matchId: delivery.match_id,
      groupId: delivery.group_id,
      type: delivery.type,
      target: 'matchDetail',
    });
    await markSent(delivery.id);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    await markFailed(delivery.id, message);
    return false;
  }
}

async function drainPending(
  limit: number,
): Promise<{ processed: number; failed: number; iterations: number }> {
  let processed = 0;
  let failed = 0;
  let iterations = 0;

  while (iterations < MAX_DRAIN_ITERATIONS) {
    iterations += 1;
    const { data, error } = await supabase.rpc('claim_pending_deliveries', { p_limit: limit });
    if (error) throw error;
    const claimed = ((data ?? []) as ClaimedDeliveryRow[]).map(normalizeClaimed);
    if (claimed.length === 0) break;

    const results = await Promise.all(claimed.map((row) => processClaimed(row)));
    for (const ok of results) {
      if (ok) processed += 1;
      else failed += 1;
    }
    if (claimed.length < limit) break;
  }

  return { processed, failed, iterations };
}

async function fetchSingleDelivery(deliveryId: string): Promise<ClaimedDelivery | null> {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select(
      `id, token, match_id, group_id, type, reminder_date,
       match:matches(starts_at, venue),
       group:groups(name)`,
    )
    .eq('id', deliveryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const match = (data as any).match as { starts_at: string | null; venue: string | null } | null;
  const group = (data as any).group as { name: string | null } | null;

  return {
    id: (data as any).id,
    token: (data as any).token,
    match_id: (data as any).match_id,
    group_id: (data as any).group_id,
    type: (data as any).type as DeliveryType,
    reminder_date: (data as any).reminder_date ?? null,
    match_starts_at: match?.starts_at ?? null,
    match_venue: match?.venue ?? null,
    group_name: group?.name ?? null,
  };
}

async function processSingle(deliveryId: string): Promise<{ processed: number; failed: number }> {
  const delivery = await fetchSingleDelivery(deliveryId);
  if (!delivery) return { processed: 0, failed: 0 };
  const ok = await processClaimed(delivery);
  return ok ? { processed: 1, failed: 0 } : { processed: 0, failed: 1 };
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
