import { createJoinCode } from '../data/seed';
import {
  fetchGroupWeeklySeries,
  upsertGroupWeeklySeriesRemote,
  type UpsertGroupWeeklySeriesInput,
} from '../services/supabase/groupWeeklySeries';
import { reportError } from '../services/logging/reportError';
import {
  createGroupRemote,
  deleteGroupRemote,
  fetchMyGroups,
  joinGroupRemote,
  kickGroupMemberRemote,
  leaveGroupRemote,
  setGroupMemberRoleRemote,
} from '../services/supabase/groups';
import type { Group, GroupRole, GroupWeeklySeries } from '../types/domain';
import type { CreateGroupResult } from '../store/types';
import type { RemoteHydrateOpts } from '../types/remoteHydration';
import { createId } from '../utils/id';
import { isRemoteUuid } from '../utils/matchId';
import { rethrowUseCaseError } from './errors';
import { runGatedGroupsHydration } from './remoteHydrationGate';

export type GroupsHydrationPayload = Awaited<ReturnType<typeof fetchMyGroups>>;

type GroupsDeps = {
  getRemoteUserId: () => string | null;
  hydrateLocalGroups: (payload: GroupsHydrationPayload) => void;
  createLocalGroup: (name: string) => Group;
  joinLocalGroup: (joinCode: string) => Group | null;
  leaveLocalGroup: (groupId: string) => void;
  deleteLocalGroupState: (groupId: string) => void;
  injectRemoteGroup: (group: Group, ownerId: string) => void;
  hydrateRemoteMatches: (opts?: RemoteHydrateOpts) => Promise<void>;
  setWeeklySeriesCache: (groupId: string, series: GroupWeeklySeries | null) => void;
  kickMemberLocal: (groupId: string, targetPlayerId: string) => void;
  setMemberRoleLocal: (groupId: string, targetPlayerId: string, role: GroupRole) => void;
};

export async function hydrateRemoteGroupsUseCase(
  deps: GroupsDeps,
  opts?: RemoteHydrateOpts,
): Promise<void> {
  if (!deps.getRemoteUserId()) return;
  await runGatedGroupsHydration(opts, async () => {
    try {
      const payload = await fetchMyGroups();
      deps.hydrateLocalGroups(payload);
    } catch (error) {
      rethrowUseCaseError('hydrateRemoteGroups', error, 'Gruplar yenilenemedi.');
    }
  });
}

export async function createGroupUseCase(deps: GroupsDeps, name: string): Promise<CreateGroupResult> {
  const uid = deps.getRemoteUserId();
  if (uid) {
    let group: Group;
    try {
      group = await createGroupRemote(name);
    } catch (error) {
      rethrowUseCaseError('createGroup', error, 'Grup olusturulamadi.');
    }
    deps.injectRemoteGroup(group, uid);
    try {
      const payload = await fetchMyGroups();
      deps.hydrateLocalGroups(payload);
      return { group, hydrateFailed: false };
    } catch (error) {
      console.warn('[usecase] createGroup hydrate failed', error);
      return { group, hydrateFailed: true };
    }
  }
  return { group: deps.createLocalGroup(name), hydrateFailed: false };
}

export async function joinGroupUseCase(deps: GroupsDeps, joinCode: string): Promise<Group | null> {
  const uid = deps.getRemoteUserId();
  if (uid) {
    try {
      const joined = await joinGroupRemote(joinCode);
      const payload = await fetchMyGroups();
      deps.hydrateLocalGroups(payload);
      return joined;
    } catch (error) {
      rethrowUseCaseError('joinGroup', error, 'Gruba katilim basarisiz oldu.');
    }
  }
  return deps.joinLocalGroup(joinCode);
}

export async function leaveGroupUseCase(deps: GroupsDeps, groupId: string): Promise<void> {
  const uid = deps.getRemoteUserId();
  if (uid) {
    try {
      await leaveGroupRemote(groupId);
      const payload = await fetchMyGroups();
      deps.hydrateLocalGroups(payload);
      return;
    } catch (error) {
      rethrowUseCaseError('leaveGroup', error, 'Gruptan ayrilma basarisiz oldu.');
    }
  }
  deps.leaveLocalGroup(groupId);
}

export async function deleteGroupUseCase(deps: GroupsDeps, groupId: string): Promise<void> {
  const uid = deps.getRemoteUserId();
  if (uid) {
    if (!isRemoteUuid(groupId)) {
      deps.deleteLocalGroupState(groupId);
      await deps.hydrateRemoteMatches({ force: true });
      return;
    }
    try {
      await deleteGroupRemote(groupId);
      const payload = await fetchMyGroups();
      deps.hydrateLocalGroups(payload);
      await deps.hydrateRemoteMatches({ force: true });
      return;
    } catch (error) {
      reportError({ error, operation: 'deleteGroup', extra: { groupId } });
      rethrowUseCaseError('deleteGroup', error, 'Grup kaldırılamadı.');
    }
  }
  deps.deleteLocalGroupState(groupId);
}

export async function fetchGroupWeeklySeriesUseCase(deps: GroupsDeps, groupId: string): Promise<void> {
  if (!deps.getRemoteUserId()) return;
  try {
    const row = await fetchGroupWeeklySeries(groupId);
    deps.setWeeklySeriesCache(groupId, row);
  } catch (error) {
    rethrowUseCaseError('fetchGroupWeeklySeries', error, 'Haftalık seri yüklenemedi.');
  }
}

export async function upsertGroupWeeklySeriesUseCase(
  deps: GroupsDeps,
  input: UpsertGroupWeeklySeriesInput,
): Promise<void> {
  if (!deps.getRemoteUserId()) return;
  try {
    const row = await upsertGroupWeeklySeriesRemote(input);
    deps.setWeeklySeriesCache(input.groupId, row);
  } catch (error) {
    rethrowUseCaseError('upsertGroupWeeklySeries', error, 'Haftalık seri kaydedilemedi.');
  }
}

export async function kickGroupMemberUseCase(
  deps: GroupsDeps,
  groupId: string,
  targetPlayerId: string,
): Promise<void> {
  if (!deps.getRemoteUserId()) return;
  try {
    await kickGroupMemberRemote(groupId, targetPlayerId);
    deps.kickMemberLocal(groupId, targetPlayerId);
    const payload = await fetchMyGroups();
    deps.hydrateLocalGroups(payload);
  } catch (error) {
    rethrowUseCaseError('kickGroupMember', error, 'Üye gruptan atılamadı.');
  }
}

export async function setGroupMemberRoleUseCase(
  deps: GroupsDeps,
  groupId: string,
  targetPlayerId: string,
  role: 'admin' | 'member',
): Promise<void> {
  if (!deps.getRemoteUserId()) return;
  try {
    await setGroupMemberRoleRemote(groupId, targetPlayerId, role);
    deps.setMemberRoleLocal(groupId, targetPlayerId, role);
    const payload = await fetchMyGroups();
    deps.hydrateLocalGroups(payload);
  } catch (error) {
    rethrowUseCaseError('setGroupMemberRole', error, 'Üye rolü değiştirilemedi.');
  }
}

export function buildLocalGroup(name: string, ownerId: string): Group {
  return {
    id: createId('group'),
    name,
    ownerId,
    joinCode: createJoinCode(),
    createdAt: new Date().toISOString(),
  };
}
