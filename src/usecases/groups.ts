import { createJoinCode } from '../data/seed';
import {
  fetchGroupWeeklySeries,
  upsertGroupWeeklySeriesRemote,
  type UpsertGroupWeeklySeriesInput,
} from '../services/supabase/groupWeeklySeries';
import {
  createGroupRemote,
  deleteGroupRemote,
  fetchMyGroups,
  joinGroupRemote,
  leaveGroupRemote,
} from '../services/supabase/groups';
import type { Group, GroupMembership, GroupWeeklySeries } from '../types/domain';
import type { CreateGroupResult } from '../store/types';
import { createId } from '../utils/id';
import { rethrowUseCaseError } from './errors';

type GroupsDeps = {
  getRemoteUserId: () => string | null;
  hydrateLocalGroups: (payload: { groups: Group[]; memberships: GroupMembership[] }) => void;
  createLocalGroup: (name: string) => Group;
  joinLocalGroup: (joinCode: string) => Group | null;
  leaveLocalGroup: (groupId: string) => void;
  deleteLocalGroupState: (groupId: string) => void;
  hydrateRemoteMatches: () => Promise<void>;
  setWeeklySeriesCache: (groupId: string, series: GroupWeeklySeries | null) => void;
};

export async function hydrateRemoteGroupsUseCase(deps: GroupsDeps): Promise<void> {
  if (!deps.getRemoteUserId()) return;
  try {
    const payload = await fetchMyGroups();
    deps.hydrateLocalGroups(payload);
  } catch (error) {
    rethrowUseCaseError('hydrateRemoteGroups', error, 'Gruplar yenilenemedi.');
  }
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
    try {
      await deleteGroupRemote(groupId);
      const payload = await fetchMyGroups();
      deps.hydrateLocalGroups(payload);
      await deps.hydrateRemoteMatches();
      return;
    } catch (error) {
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

export function buildLocalGroup(name: string, ownerId: string): Group {
  return {
    id: createId('group'),
    name,
    ownerId,
    joinCode: createJoinCode(),
    createdAt: new Date().toISOString(),
  };
}
