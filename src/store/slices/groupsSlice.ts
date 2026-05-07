import type { StateCreator } from 'zustand';
import type { Group, GroupMembership } from '../../types/domain';
import {
  buildLocalGroup,
  createGroupUseCase,
  hydrateRemoteGroupsUseCase,
  joinGroupUseCase,
  leaveGroupUseCase,
} from '../../usecases/groups';
import type { AppState, GroupsSlice } from '../types';

function hydrateGroupsState(
  set: Parameters<StateCreator<AppState>>[0],
  payload: { groups: Group[]; memberships: GroupMembership[] },
) {
  set({ groups: payload.groups, groupMemberships: payload.memberships });
}

function createLocalGroup(
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1],
  name: string,
): Group {
  const localGroup = buildLocalGroup(name, get().getCurrentUserId());
  const membership: GroupMembership = {
    groupId: localGroup.id,
    playerId: localGroup.ownerId,
    role: 'owner',
    createdAt: localGroup.createdAt,
  };
  set((state) => ({
    groups: [localGroup, ...state.groups],
    groupMemberships: [membership, ...state.groupMemberships],
  }));
  return localGroup;
}

function joinLocalGroup(
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1],
  joinCode: string,
): Group | null {
  const compact = joinCode.replace(/[\s-]/g, '').toUpperCase();
  const state = get();
  const found = state.groups.find((group) => group.joinCode.replace(/[\s-]/g, '').toUpperCase() === compact);
  if (!found) return null;
  const currentUserId = state.getCurrentUserId();
  if (
    !state.groupMemberships.some(
      (membership) => membership.groupId === found.id && membership.playerId === currentUserId,
    )
  ) {
    set((prev) => ({
      groupMemberships: [
        ...prev.groupMemberships,
        {
          groupId: found.id,
          playerId: currentUserId,
          role: 'member',
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }
  return found;
}

function leaveLocalGroup(
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1],
  groupId: string,
) {
  const currentUserId = get().getCurrentUserId();
  set((state) => ({
    groupMemberships: state.groupMemberships.filter(
      (membership) => !(membership.groupId === groupId && membership.playerId === currentUserId),
    ),
  }));
}

function buildGroupsUseCaseDeps(set: Parameters<StateCreator<AppState>>[0], get: Parameters<StateCreator<AppState>>[1]) {
  return {
    getRemoteUserId: () => get().remoteUserId,
    hydrateLocalGroups: (payload: { groups: Group[]; memberships: GroupMembership[] }) =>
      hydrateGroupsState(set, payload),
    createLocalGroup: (name: string) => createLocalGroup(set, get, name),
    joinLocalGroup: (joinCode: string) => joinLocalGroup(set, get, joinCode),
    leaveLocalGroup: (groupId: string) => leaveLocalGroup(set, get, groupId),
  };
}

export const createGroupsSlice: StateCreator<AppState, [], [], GroupsSlice> = (set, get) => ({
  groups: [],
  groupMemberships: [],

  hydrateRemoteGroups: () => hydrateRemoteGroupsUseCase(buildGroupsUseCaseDeps(set, get)),

  createGroup: (name) => createGroupUseCase(buildGroupsUseCaseDeps(set, get), name),

  joinGroup: (joinCode) => joinGroupUseCase(buildGroupsUseCaseDeps(set, get), joinCode),

  leaveGroup: (groupId) => leaveGroupUseCase(buildGroupsUseCaseDeps(set, get), groupId),
});
