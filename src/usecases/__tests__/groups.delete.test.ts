import * as groupsService from '../../services/supabase/groups';
import { AppError } from '../../services/supabase/errors';
import type { Group, GroupMembership } from '../../types/domain';
import { deleteGroupUseCase, type GroupsHydrationPayload } from '../groups';

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

function samplePayload(groups: Group[], memberships: GroupMembership[] = []): GroupsHydrationPayload {
  return { groups, memberships, profiles: [] };
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

  it('with remote session and local-only group id clears local state without RPC', async () => {
    const deps = buildDeps();
    await deleteGroupUseCase(deps, LOCAL_GROUP_ID);
    expect(deps.deleteLocalGroupState).toHaveBeenCalledWith(LOCAL_GROUP_ID);
    expect(deps.hydrateRemoteMatches).toHaveBeenCalledWith({ force: true });
    expect(mockDeleteGroupRemote).not.toHaveBeenCalled();
    expect(deps.hydrateLocalGroups).not.toHaveBeenCalled();
  });

  it('hydrates after successful delete_group RPC', async () => {
    mockDeleteGroupRemote.mockResolvedValue(undefined);
    const payload = samplePayload([]);
    mockFetchMyGroups.mockResolvedValue(payload);
    const deps = buildDeps();
    await deleteGroupUseCase(deps, GROUP_UUID);
    expect(mockDeleteGroupRemote).toHaveBeenCalledWith(GROUP_UUID);
    expect(deps.hydrateLocalGroups).toHaveBeenCalledWith(payload);
    expect(deps.hydrateRemoteMatches).toHaveBeenCalledWith({ force: true });
  });

  it('rethrows when delete_group RPC fails', async () => {
    const err = new AppError({
      code: 'FORBIDDEN',
      operation: 'deleteGroupRemote',
      message: 'Bu grubu yalnızca grup yöneticisi kaldırabilir.',
    });
    mockDeleteGroupRemote.mockRejectedValue(err);
    const deps = buildDeps();
    await expect(deleteGroupUseCase(deps, GROUP_UUID)).rejects.toBe(err);
    expect(mockFetchMyGroups).not.toHaveBeenCalled();
    expect(deps.hydrateLocalGroups).not.toHaveBeenCalled();
  });
});
