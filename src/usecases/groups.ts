import { createJoinCode } from '../data/seed';
import { createGroupRemote, fetchMyGroups, joinGroupRemote, leaveGroupRemote } from '../services/supabase/groups';
import type { Group, GroupMembership } from '../types/domain';
import { createId } from '../utils/id';
import { rethrowUseCaseError } from './errors';

type GroupsDeps = {
  getRemoteUserId: () => string | null;
  hydrateLocalGroups: (payload: { groups: Group[]; memberships: GroupMembership[] }) => void;
  createLocalGroup: (name: string) => Group;
  joinLocalGroup: (joinCode: string) => Group | null;
  leaveLocalGroup: (groupId: string) => void;
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

export async function createGroupUseCase(deps: GroupsDeps, name: string): Promise<Group> {
  const uid = deps.getRemoteUserId();
  if (uid) {
    try {
      const group = await createGroupRemote(name);
      const payload = await fetchMyGroups();
      deps.hydrateLocalGroups(payload);
      return group;
    } catch (error) {
      rethrowUseCaseError('createGroup', error, 'Grup olusturulamadi.');
    }
  }
  return deps.createLocalGroup(name);
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

export function buildLocalGroup(name: string, ownerId: string): Group {
  return {
    id: createId('group'),
    name,
    ownerId,
    joinCode: createJoinCode(),
    createdAt: new Date().toISOString(),
  };
}
