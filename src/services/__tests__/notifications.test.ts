import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getSupabaseClient } from '../../lib/supabase';
import { drainPendingInAppDeliveries, notificationInternals } from '../notifications';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 'DEFAULT' },
  getExpoPushTokenAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve()),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  setNotificationHandler: jest.fn(),
}));

jest.mock('../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockScheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.MockedFunction<
  typeof Notifications.scheduleNotificationAsync
>;

function makeDeliveryRow(id: string, createdAt: string) {
  return {
    id,
    match_id: 'match-1',
    group_id: 'group-1',
    type: 'lineup_published' as const,
    created_at: createdAt,
    match: [
      {
        starts_at: '2026-05-10T18:00:00.000Z',
        venue: 'Saha 1',
        score_a: null,
        score_b: null,
        organizer: [{ display_name: 'Ali' }],
      },
    ],
    group: [{ name: 'Pazar Grubu' }],
  };
}

function makeDelivery(id: string, createdAt: string) {
  return {
    id,
    match_id: 'match-1',
    group_id: 'group-1',
    type: 'lineup_published' as const,
    created_at: createdAt,
    match: {
      starts_at: '2026-05-10T18:00:00.000Z',
      venue: 'Saha 1',
      score_a: null,
      score_b: null,
      organizer: { display_name: 'Ali' },
    },
    group: { name: 'Pazar Grubu' },
  };
}

function mockDeliveries(data: unknown[]) {
  const limit = jest.fn().mockResolvedValue({ data, error: null });
  const order = jest.fn(() => ({ limit }));
  const gte = jest.fn(() => ({ order }));
  const eq = jest.fn(() => ({ gte }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  mockGetSupabaseClient.mockReturnValue({ from } as unknown as ReturnType<typeof getSupabaseClient>);
  return { from, select, eq, gte, order, limit };
}

describe('in-app notification drain', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('stores a cursor and does not replay handled deliveries', async () => {
    const createdAt = '2026-05-10T12:00:00.000Z';
    mockDeliveries([makeDeliveryRow('delivery-1', createdAt), makeDeliveryRow('delivery-2', createdAt)]);

    await expect(drainPendingInAppDeliveries('2026-05-10T11:59:00.000Z')).resolves.toBe(2);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(2);

    const cursor = await notificationInternals.readInAppDeliveryCursor();
    expect(cursor).toEqual({
      lastCreatedAt: createdAt,
      idsAtLastCreatedAt: ['delivery-1', 'delivery-2'],
    });

    mockScheduleNotificationAsync.mockClear();
    mockDeliveries([makeDeliveryRow('delivery-1', createdAt), makeDeliveryRow('delivery-2', createdAt)]);

    await expect(drainPendingInAppDeliveries()).resolves.toBe(0);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('advances cursor for multiple deliveries with the same timestamp', () => {
    const first = makeDelivery('delivery-1', '2026-05-10T12:00:00.000Z');
    const second = makeDelivery('delivery-2', '2026-05-10T12:00:00.000Z');
    const cursor = notificationInternals.advanceCursor(
      notificationInternals.advanceCursor({ lastCreatedAt: null, idsAtLastCreatedAt: [] }, first),
      second,
    );

    expect(notificationInternals.shouldSkipDeliveryForCursor(first, cursor)).toBe(true);
    expect(notificationInternals.shouldSkipDeliveryForCursor(second, cursor)).toBe(true);
    expect(cursor.idsAtLastCreatedAt).toEqual(['delivery-1', 'delivery-2']);
  });
});
