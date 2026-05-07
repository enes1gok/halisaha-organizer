// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendExpoPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: 'default',
      data,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo push failed: ${response.status} ${text}`);
  }
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as { deliveryId?: string };
    if (!payload.deliveryId) {
      return new Response(JSON.stringify({ error: 'deliveryId gerekli' }), { status: 400 });
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from('notification_deliveries')
      .select('id, token, match_id, group_id')
      .eq('id', payload.deliveryId)
      .maybeSingle();
    if (deliveryError) throw deliveryError;
    if (!delivery) {
      return new Response(JSON.stringify({ error: 'Delivery bulunamadi' }), { status: 404 });
    }

    const { data: group } = await supabase.from('groups').select('name').eq('id', delivery.group_id).maybeSingle();

    await sendExpoPush(delivery.token, 'Yeni grup maci', `${group?.name ?? 'Grubunuz'} grubunda yeni mac acildi`, {
      matchId: delivery.match_id,
      groupId: delivery.group_id,
      target: 'matchDetail',
    });

    const { error: updateError } = await supabase
      .from('notification_deliveries')
      .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
      .eq('id', delivery.id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
