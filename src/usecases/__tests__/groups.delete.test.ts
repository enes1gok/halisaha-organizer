import * as groupsService from '../../services/supabase/groups';
import type { Group, GroupMembership } from '../../types/domain';
import { deleteGroupUseCase } from '../groups';

jest.mock('../../services/supabase/groups', () => ({
  createGroupRemote: jest.fn(),
  joinGroupRemote: jest.fn(),
  leaveGroupRemote: jest.fn(),
  deleteGroupRemote: jest.fn(),
  fetchMyGroups: jest.fn(),
}));

const mockDeleteGroupRemote = groupsService.deleteGroupRemote as jest.MockedFunction<
  typeof groupsService.deleteGroupRemote
>;
const mockFetchMyGroups = groupsService.fetchMyGroups as jest.MockedFunction<typeof groupsService.fetchMyGroups>;

const REMOTE_USER = 'a0000000-0000-4000-8000-000000000001';
const GROUP_UUID = 'c0000000-0000-4000-8000-000000000010';
const LOCAL_GROUP_ID = 'group-m3k9xj-a1b2c3';

function samplePayload(groups: Group[], memberships: GroupMembership[] = []) {
  return { groups, memberships };
}

function buildDeps(overrides: Partial<Parameters<typeof deleteGroupUseCase>[0]> = {}) {
  return {
    getRemoteUserId: () => REMOTE_USER as unknown as string | null,
    hydrateLocalGroups: jest.fn(),
    createLocalGroup: jest.fn(),
    joinLocalGroup: jest.fn(),
    leaveLocalGroup: jest.fn(),
    deleteLocalGroupState: jest.fn(),
    hydrateRemoteMatches: jest.fn().mockResolvedValue(undefined),
    setWeeklySeriesCache: jest.fn(),
    ...overrides,
  };
}

describe('deleteGroupUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('without remote session only clears local state', async () => {
    const deps = buildDeps({ getRemoteUserId: () => null });
    await deleteGroupUseCase(deps, GROUP_UUID);
    expect(deps.deleteLocalGroupState).toHaveBeenCalledWith(GROUP_UUID);
    expect(mockDeleteGroupRemote).not.toHaveBeenCalled();
    expect(deps.hydrateLocalGroups).not.toHaveBeenCalled();
  });

  it('with remote session and local-only group id clears local state without DELETE', async () => {
    const deps = buildDeps();
    await deleteGroupUseCase(deps, LOCAL_GROUP_ID);
    expect(deps.deleteLocalGroupState).toHaveBeenCalledWith(LOCAL_GROUP_ID);
    expect(deps.hydrateRemoteMatches).toHaveBeenCalled();
    expect(mockDeleteGroupRemote).not.toHaveBeenCalled();
    expect(deps.hydrateLocalGroups).not.toHaveBeenCalled();
  });

  it('hydrates after successful remote delete', async () => {
    mockDeleteGroupRemote.mockResolvedValue({ deletedRow: true });
    const payload = samplePayload([]);
    mockFetchMyGroups.mockResolvedValue(payload);
    const deps = buildDeps();
    await deleteGroupUseCase(deps, GROUP_UUID);
    expect(mockDeleteGroupRemote).toHaveBeenCalledWith(GROUP_UUID);
    expect(deps.hydrateLocalGroups).toHaveBeenCalledWith(payload);
    expect(deps.hydrateRemoteMatches).toHaveBeenCalled();
  });

  it('treats empty DELETE as success when group no longer appears in fetch (idempotent)', async () => {
    mockDeleteGroupRemote.mockResolvedValue({ deletedRow: false });
    const payload = samplePayload([]);
    mockFetchMyGroups.mockResolvedValue(payload);
    const deps = buildDeps();
    await deleteGroupUseCase(deps, GROUP_UUID);
    expect(deps.hydrateLocalGroups).toHaveBeenCalledWith(payload);
    expect(deps.hydrateRemoteMatches).toHaveBeenCalled();
  });

  it('throws NOT_FOUND when DELETE affects no row but group is still in list', async () => {
    mockDeleteGroupRemote.mockResolvedValue({ deletedRow: false });
    const stillThere: Group = {
      id: GROUP_UUID,
      name: 'G',
      ownerId: REMOTE_USER,
      joinCode: 'ABCD',
      createdAt: new Date().toISOString(),
    };
    mockFetchMyGroups.mockResolvedValue(samplePayload([stillThere]));
    const deps = buildDeps();
    await expect(deleteGroupUseCase(deps, GROUP_UUID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      operation: 'deleteGroupRemote',
    });
    expect(deps.hydrateLocalGroups).not.toHaveBeenCalled();
  });
});
