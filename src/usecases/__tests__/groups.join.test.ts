import * as groupsService from '../../services/supabase/groups';
import type { Group, GroupMembership } from '../../types/domain';
import { joinGroupUseCase } from '../groups';

jest.mock('../../services/supabase/groups', () => ({
  createGroupRemote: jest.fn(),
  joinGroupRemote: jest.fn(),
  leaveGroupRemote: jest.fn(),
  deleteGroupRemote: jest.fn(),
  fetchMyGroups: jest.fn(),
}));

const mockJoinGroupRemote = groupsService.joinGroupRemote as jest.MockedFunction<
  typeof groupsService.joinGroupRemote
>;
const mockFetchMyGroups = groupsService.fetchMyGroups as jest.MockedFunction<typeof groupsService.fetchMyGroups>;

const REMOTE_USER = 'a0000000-0000-4000-8000-000000000002';
const OWNER_ID = 'a0000000-0000-4000-8000-000000000001';
const GROUP_ID = 'c0000000-0000-4000-8000-000000000010';

const group: Group = {
  id: GROUP_ID,
  name: 'Pazar Grubu',
  ownerId: OWNER_ID,
  joinCode: 'PAZAR123',
  createdAt: '2026-05-09T12:00:00.000Z',
};

const memberships: GroupMembership[] = [
  {
    groupId: GROUP_ID,
    playerId: OWNER_ID,
    role: 'owner',
    createdAt: '2026-05-09T12:00:00.000Z',
  },
  {
    groupId: GROUP_ID,
    playerId: REMOTE_USER,
    role: 'member',
    createdAt: '2026-05-09T12:01:00.000Z',
  },
];

function buildDeps(overrides: Partial<Parameters<typeof joinGroupUseCase>[0]> = {}) {
  return {
    getRemoteUserId: () => REMOTE_USER as string | null,
    hydrateLocalGroups: jest.fn(),
    createLocalGroup: jest.fn(),
    joinLocalGroup: jest.fn(),
    leaveLocalGroup: jest.fn(),
    deleteLocalGroupState: jest.fn(),
    injectRemoteGroup: jest.fn(),
    hydrateRemoteMatches: jest.fn().mockResolvedValue(undefined),
    setWeeklySeriesCache: jest.fn(),
    kickMemberLocal: jest.fn(),
    setMemberRoleLocal: jest.fn(),
    ...overrides,
  };
}

describe('joinGroupUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hydrates the full remote roster after joining by code', async () => {
    const payload = {
      groups: [group],
      memberships,
      profiles: [
        {
          id: OWNER_ID,
          display_name: 'Ali Yönetici',
          photo_uri: null,
          position: 'DEF' as const,
          preferred_foot: 'right' as const,
        },
        {
          id: REMOTE_USER,
          display_name: 'Veli Üye',
          photo_uri: null,
          position: 'MID' as const,
          preferred_foot: 'left' as const,
        },
      ],
    };
    mockJoinGroupRemote.mockResolvedValue(group);
    mockFetchMyGroups.mockResolvedValue(payload);
    const deps = buildDeps();

    const result = await joinGroupUseCase(deps, 'PAZAR123');

    expect(result).toBe(group);
    expect(mockJoinGroupRemote).toHaveBeenCalledWith('PAZAR123');
    expect(deps.hydrateLocalGroups).toHaveBeenCalledWith(payload);
  });
});
