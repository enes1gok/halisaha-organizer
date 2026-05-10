import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase';
import { useAppStore } from '../../../store/useAppStore';
import { runRemoteCatchUp } from '../remoteCatchUp';

jest.mock('../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
  isSupabaseConfigured: jest.fn(),
}));

jest.mock('../../../store/useAppStore', () => ({
  useAppStore: {
    persist: { hasHydrated: jest.fn() },
    getState: jest.fn(),
  },
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockIsSupabaseConfigured = isSupabaseConfigured as jest.MockedFunction<typeof isSupabaseConfigured>;
const mockUseAppStore = useAppStore as unknown as {
  persist: { hasHydrated: jest.Mock };
  getState: jest.Mock;
};

describe('runRemoteCatchUp', () => {
  const getSession = jest.fn();
  const hydrateRemoteMatches = jest.fn();
  const hydrateRemoteGroups = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      auth: { getSession },
    } as unknown as ReturnType<typeof getSupabaseClient>);
    mockUseAppStore.persist.hasHydrated.mockReturnValue(true);
    mockUseAppStore.getState.mockReturnValue({
      hydrateRemoteMatches,
      hydrateRemoteGroups,
    });
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    hydrateRemoteMatches.mockResolvedValue(undefined);
    hydrateRemoteGroups.mockResolvedValue(undefined);
  });

  it('hydrates matches and groups when authenticated', async () => {
    await expect(runRemoteCatchUp({ reason: 'foreground', now: 1_000 })).resolves.toEqual({
      status: 'synced',
    });

    expect(hydrateRemoteMatches).toHaveBeenCalledTimes(1);
    expect(hydrateRemoteGroups).toHaveBeenCalledTimes(1);
  });

  it('throttles repeated syncs for the same reason', async () => {
    await runRemoteCatchUp({ reason: 'foreground', now: 1_000, minIntervalMs: 1_000 });
    hydrateRemoteMatches.mockClear();
    hydrateRemoteGroups.mockClear();

    await expect(runRemoteCatchUp({ reason: 'foreground', now: 1_500, minIntervalMs: 1_000 })).resolves.toEqual({
      status: 'skipped',
      reason: 'throttled',
    });

    expect(hydrateRemoteMatches).not.toHaveBeenCalled();
    expect(hydrateRemoteGroups).not.toHaveBeenCalled();
  });

  it('skips without touching Supabase when store hydration is not ready', async () => {
    mockUseAppStore.persist.hasHydrated.mockReturnValue(false);

    await expect(runRemoteCatchUp({ reason: 'background' })).resolves.toEqual({
      status: 'skipped',
      reason: 'store_not_hydrated',
    });

    expect(getSession).not.toHaveBeenCalled();
    expect(hydrateRemoteMatches).not.toHaveBeenCalled();
  });

  it('skips hydration when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(runRemoteCatchUp({ reason: 'background' })).resolves.toEqual({
      status: 'skipped',
      reason: 'unauthenticated',
    });

    expect(hydrateRemoteMatches).not.toHaveBeenCalled();
    expect(hydrateRemoteGroups).not.toHaveBeenCalled();
  });
});
