import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../lib/supabase';
import { AppState, type AppStateStatus, Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type DeliveryType =
  | 'initial'
  | 'reminder'
  | 'payment_reminder'
  | 'match_cancelled'
  | 'venue_change'
  | 'lineup_published'
  | 'post_match_rating_reminder'
  | 'match_result'
  | 'streak_at_risk';

type InAppDelivery = {
  id: string;
  match_id: string | null;
  group_id: string | null;
  type: DeliveryType;
  created_at: string;
  match: {
    starts_at: string | null;
    venue: string | null;
    score_a: number | null;
    score_b: number | null;
    organizer: { display_name: string | null } | null;
  } | null;
  group: { name: string | null } | null;
};

type InAppDeliveryRow = Omit<InAppDelivery, 'match' | 'group'> & {
  match:
    | {
        starts_at: string | null;
        venue: string | null;
        score_a: number | null;
        score_b: number | null;
        organizer: { display_name: string | null }[] | null;
      }[]
    | null;
  group: { name: string | null }[] | null;
};

type InAppDeliveryCursor = {
  lastCreatedAt: string | null;
  idsAtLastCreatedAt: string[];
};

const IN_APP_CURSOR_STORAGE_KEY = '@halisaha/in-app-deliveries:cursor';
const IN_APP_COLD_START_LOOKBACK_MS = 30 * 60 * 1000;

function normalizeInAppDelivery(row: InAppDeliveryRow): InAppDelivery {
  const matchRow = row.match?.[0] ?? null;
  const organizerRow = matchRow?.organizer?.[0] ?? null;
  const groupRow = row.group?.[0] ?? null;
  return {
    id: row.id,
    match_id: row.match_id,
    group_id: row.group_id,
    type: row.type,
    created_at: row.created_at,
    match: matchRow
      ? {
          starts_at: matchRow.starts_at,
          venue: matchRow.venue,
          score_a: (matchRow as { score_a?: number | null }).score_a ?? null,
          score_b: (matchRow as { score_b?: number | null }).score_b ?? null,
          organizer: organizerRow ? { display_name: organizerRow.display_name } : null,
        }
      : null,
    group: groupRow ? { name: groupRow.name } : null,
  };
}

const handledInAppDeliveryIds = new Set<string>();

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

function buildInAppMessage(delivery: InAppDelivery): { title: string; body: string } {
  const groupName = delivery.group?.name?.trim() ? delivery.group.name : 'Grubunuz';
  if (delivery.type === 'reminder') {
    const detail = [formatMatchTime(delivery.match?.starts_at ?? null), delivery.match?.venue ?? '']
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
    const detail = [formatMatchTime(delivery.match?.starts_at ?? null), delivery.match?.venue ?? '']
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
    const venue = (delivery.match?.venue ?? '').trim();
    const when = formatMatchTime(delivery.match?.starts_at ?? null);
    const tail = [when, venue].filter(Boolean).join(' • ');
    return {
      title: 'Saha güncellendi',
      body: tail ? `${groupName} • ${tail}` : `${groupName} grubunda saha bilgisi güncellendi`,
    };
  }
  if (delivery.type === 'lineup_published') {
    const organizerLabel = (delivery.match?.organizer?.display_name ?? '').trim() || 'Organizatör';
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
    const sa = delivery.match?.score_a ?? 0;
    const sb = delivery.match?.score_b ?? 0;
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
  return {
    title: 'Yeni grup maçı',
    body: `${groupName} grubunda yeni maç açıldı`,
  };
}

async function upsertPresence(appState: AppStateStatus): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const normalizedState = appState === 'active' ? 'foreground' : 'background';
  await supabase.from('notification_presence').upsert(
    {
      user_id: user.id,
      app_state: normalizedState,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}

function fallbackInAppSinceIso(): string {
  return new Date(Date.now() - IN_APP_COLD_START_LOOKBACK_MS).toISOString();
}

async function readInAppDeliveryCursor(): Promise<InAppDeliveryCursor> {
  const raw = await AsyncStorage.getItem(IN_APP_CURSOR_STORAGE_KEY);
  if (!raw) return { lastCreatedAt: null, idsAtLastCreatedAt: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<InAppDeliveryCursor>;
    return {
      lastCreatedAt: typeof parsed.lastCreatedAt === 'string' ? parsed.lastCreatedAt : null,
      idsAtLastCreatedAt: Array.isArray(parsed.idsAtLastCreatedAt)
        ? parsed.idsAtLastCreatedAt.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return { lastCreatedAt: null, idsAtLastCreatedAt: [] };
  }
}

async function writeInAppDeliveryCursor(cursor: InAppDeliveryCursor): Promise<void> {
  await AsyncStorage.setItem(IN_APP_CURSOR_STORAGE_KEY, JSON.stringify(cursor));
}

function shouldSkipDeliveryForCursor(delivery: InAppDelivery, cursor: InAppDeliveryCursor): boolean {
  if (!cursor.lastCreatedAt) return false;
  if (delivery.created_at < cursor.lastCreatedAt) return true;
  if (delivery.created_at === cursor.lastCreatedAt) {
    return cursor.idsAtLastCreatedAt.includes(delivery.id);
  }
  return false;
}

function advanceCursor(cursor: InAppDeliveryCursor, delivery: InAppDelivery): InAppDeliveryCursor {
  if (!cursor.lastCreatedAt || delivery.created_at > cursor.lastCreatedAt) {
    return { lastCreatedAt: delivery.created_at, idsAtLastCreatedAt: [delivery.id] };
  }
  if (delivery.created_at === cursor.lastCreatedAt && !cursor.idsAtLastCreatedAt.includes(delivery.id)) {
    return {
      lastCreatedAt: cursor.lastCreatedAt,
      idsAtLastCreatedAt: [...cursor.idsAtLastCreatedAt, delivery.id],
    };
  }
  return cursor;
}

export async function drainPendingInAppDeliveries(sinceIso?: string): Promise<number> {
  let cursor = await readInAppDeliveryCursor();
  const lowerBoundIso = sinceIso ?? cursor.lastCreatedAt ?? fallbackInAppSinceIso();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select(
      `id, match_id, group_id, type, created_at,
       match:matches(starts_at, venue, score_a, score_b, organizer:profiles!matches_organizer_id_fkey(display_name)),
       group:groups(name)`,
    )
    .eq('status', 'in_app')
    .gte('created_at', lowerBoundIso)
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) return 0;

  const deliveries = ((data ?? []) as InAppDeliveryRow[]).map(normalizeInAppDelivery);
  let shown = 0;
  for (const row of deliveries) {
    if (shouldSkipDeliveryForCursor(row, cursor)) continue;
    if (handledInAppDeliveryIds.has(row.id)) continue;
    handledInAppDeliveryIds.add(row.id);
    const { title, body } = buildInAppMessage(row);
    const target = row.type === 'streak_at_risk' ? 'profile' : 'matchDetail';
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          ...(row.match_id ? { matchId: row.match_id } : {}),
          ...(row.group_id ? { groupId: row.group_id } : {}),
          type: row.type,
          target,
        },
      },
      trigger: null,
    });
    cursor = advanceCursor(cursor, row);
    shown += 1;
  }
  if (shown > 0) {
    await writeInAppDeliveryCursor(cursor);
  }
  return shown;
}

export function startContextAwareNotificationSync(): () => void {
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let bannerPollTimer: ReturnType<typeof setInterval> | null = null;

  const startHeartbeat = () => {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      void upsertPresence('active');
    }, 45_000);
  };

  const stopHeartbeat = () => {
    if (!heartbeatTimer) return;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const handleStateChange = (nextState: AppStateStatus) => {
    void upsertPresence(nextState);
    if (nextState === 'active') startHeartbeat();
    else stopHeartbeat();
  };

  handleStateChange(AppState.currentState);
  const appStateSub = AppState.addEventListener('change', handleStateChange);

  bannerPollTimer = setInterval(() => {
    if (AppState.currentState !== 'active') return;
    void drainPendingInAppDeliveries();
  }, 15_000);
  void drainPendingInAppDeliveries();

  return () => {
    appStateSub.remove();
    stopHeartbeat();
    if (bannerPollTimer) clearInterval(bannerPollTimer);
    bannerPollTimer = null;
    void upsertPresence('background');
  };
}

export async function registerForPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data ?? null;
}
