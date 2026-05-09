import * as groupsService from '../../services/supabase/groups';
import { useAppStore } from '../useAppStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../services/supabase/groups', () => ({
  createGroupRemote: jest.fn(),
  joinGroupRemote: jest.fn(),
  leaveGroupRemote: jest.fn(),
  deleteGroupRemote: jest.fn(),
  fetchMyGroups: jest.fn(),
}));

const mockFetchMyGroups = groupsService.fetchMyGroups as jest.MockedFunction<typeof groupsService.fetchMyGroups>;

const OWNER_ID = 'a0000000-0000-4000-8000-000000000001';
const MEMBER_ID = 'a0000000-0000-4000-8000-000000000002';
const GROUP_ID = 'c0000000-0000-4000-8000-000000000010';

describe('groups hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.getState().resetToSeed();
    useAppStore.getState().setRemoteUserId(MEMBER_ID);
  });

  it('keeps the full roster and merges public member profiles', async () => {
    mockFetchMyGroups.mockResolvedValue({
      groups: [
        {
          id: GROUP_ID,
          name: 'Pazar Grubu',
          ownerId: OWNER_ID,
          joinCode: 'PAZAR123',
          createdAt: '2026-05-09T12:00:00.000Z',
        },
      ],
      memberships: [
        {
          groupId: GROUP_ID,
          playerId: OWNER_ID,
          role: 'owner',
          createdAt: '2026-05-09T12:00:00.000Z',
        },
        {
          groupId: GROUP_ID,
          playerId: MEMBER_ID,
          role: 'member',
          createdAt: '2026-05-09T12:01:00.000Z',
        },
      ],
      profiles: [
        {
          id: OWNER_ID,
          display_name: 'Ali Yönetici',
          photo_uri: null,
          position: 'DEF',
          preferred_foot: 'right',
        },
        {
          id: MEMBER_ID,
          display_name: 'Veli Üye',
          photo_uri: null,
          position: 'MID',
          preferred_foot: 'left',
        },
      ],
    });

    await useAppStore.getState().hydrateRemoteGroups();

    const state = useAppStore.getState();
    expect(state.groupMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupId: GROUP_ID, playerId: OWNER_ID, role: 'owner' }),
        expect.objectContaining({ groupId: GROUP_ID, playerId: MEMBER_ID, role: 'member' }),
      ]),
    );
    expect(state.getPlayer(OWNER_ID)?.name).toBe('Ali Yönetici');
    expect(state.getPlayer(MEMBER_ID)?.name).toBe('Veli Üye');
  });
});
