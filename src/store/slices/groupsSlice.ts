import type { StateCreator } from 'zustand';
import type { Group, GroupMembership, GroupWeeklySeries } from '../../types/domain';
import {
  buildLocalGroup,
  createGroupUseCase,
  deleteGroupUseCase,
  fetchGroupWeeklySeriesUseCase,
  type GroupsHydrationPayload,
  hydrateRemoteGroupsUseCase,
  joinGroupUseCase,
  kickGroupMemberUseCase,
  leaveGroupUseCase,
  setGroupMemberRoleUseCase,
  updateGroupPhotoUseCase,
  upsertGroupWeeklySeriesUseCase,
} from '../../usecases/groups';
import type { UpsertGroupWeeklySeriesInput } from '../../services/supabase/groupWeeklySeries';
import type { AppState, GroupsSlice } from '../types';
import type { RemoteHydrateOpts } from '../../types/remoteHydration';
import { upsertProfilesIntoPlayers, withSyncedStats } from '../helpers';

function hydrateGroupsState(
  set: Parameters<StateCreator<AppState>>[0],
  payload: GroupsHydrationPayload,
) {
  set((state) => {
    const players = payload.profiles.length
      ? withSyncedStats(upsertProfilesIntoPlayers(state.players, payload.profiles), state.matches)
      : state.players;

    return {
      groups: payload.groups,
      groupMemberships: payload.memberships,
      players,
    };
  });
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

function injectRemoteGroup(
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1],
  group: Group,
  ownerId: string,
): void {
  set((state) => {
    const alreadyInGroups = state.groups.some((g) => g.id === group.id);
    const alreadyMember = state.groupMemberships.some(
      (m) => m.groupId === group.id && m.playerId === ownerId,
    );
    const membership: GroupMembership = {
      groupId: group.id,
      playerId: ownerId,
      role: 'owner',
      createdAt: group.createdAt,
    };
    return {
      groups: alreadyInGroups ? state.groups : [group, ...state.groups],
      groupMemberships: alreadyMember
        ? state.groupMemberships
        : [membership, ...state.groupMemberships],
    };
  });
}

function kickMemberLocal(
  set: Parameters<StateCreator<AppState>>[0],
  groupId: string,
  targetPlayerId: string,
) {
  set((state) => ({
    groupMemberships: state.groupMemberships.filter(
      (m) => !(m.groupId === groupId && m.playerId === targetPlayerId),
    ),
  }));
}

function setMemberRoleLocal(
  set: Parameters<StateCreator<AppState>>[0],
  groupId: string,
  targetPlayerId: string,
  role: import('../../types/domain').GroupRole,
) {
  set((state) => ({
    groupMemberships: state.groupMemberships.map((m) =>
      m.groupId === groupId && m.playerId === targetPlayerId ? { ...m, role } : m,
    ),
  }));
}

function updateGroupPhotoLocal(
  set: Parameters<StateCreator<AppState>>[0],
  groupId: string,
  photoUri: string,
) {
  set((state) => ({
    groups: state.groups.map((g) =>
      g.id === groupId ? { ...g, photoUri } : g,
    ),
  }));
}

function deleteLocalGroupState(set: Parameters<StateCreator<AppState>>[0], groupId: string) {
  set((state) => {
    const weeklySeriesByGroupId = { ...state.weeklySeriesByGroupId };
    delete weeklySeriesByGroupId[groupId];
    return {
      groups: state.groups.filter((g) => g.id !== groupId),
      groupMemberships: state.groupMemberships.filter((m) => m.groupId !== groupId),
      matches: state.matches.map((m) =>
        m.groupId === groupId ? { ...m, groupId: undefined } : m,
      ),
      weeklySeriesByGroupId,
    };
  });
}

function buildGroupsUseCaseDeps(set: Parameters<StateCreator<AppState>>[0], get: Parameters<StateCreator<AppState>>[1]) {
  return {
    getRemoteUserId: () => get().remoteUserId,
    hydrateLocalGroups: (payload: GroupsHydrationPayload) => hydrateGroupsState(set, payload),
    createLocalGroup: (name: string) => createLocalGroup(set, get, name),
    joinLocalGroup: (joinCode: string) => joinLocalGroup(set, get, joinCode),
    leaveLocalGroup: (groupId: string) => leaveLocalGroup(set, get, groupId),
    deleteLocalGroupState: (groupId: string) => deleteLocalGroupState(set, groupId),
    injectRemoteGroup: (group: Group, ownerId: string) => injectRemoteGroup(set, get, group, ownerId),
    hydrateRemoteMatches: (opts?: RemoteHydrateOpts) => get().hydrateRemoteMatches(opts),
    setWeeklySeriesCache: (groupId: string, series: GroupWeeklySeries | null) =>
      set((s) => ({
        weeklySeriesByGroupId: { ...s.weeklySeriesByGroupId, [groupId]: series },
      })),
    kickMemberLocal: (groupId: string, targetPlayerId: string) =>
      kickMemberLocal(set, groupId, targetPlayerId),
    setMemberRoleLocal: (groupId: string, targetPlayerId: string, role: import('../../types/domain').GroupRole) =>
      setMemberRoleLocal(set, groupId, targetPlayerId, role),
    updateGroupPhotoLocal: (groupId: string, photoUri: string) =>
      updateGroupPhotoLocal(set, groupId, photoUri),
  };
}

export const createGroupsSlice: StateCreator<AppState, [], [], GroupsSlice> = (set, get) => ({
  groups: [],
  groupMemberships: [],
  weeklySeriesByGroupId: {},

  hydrateRemoteGroups: (opts) => hydrateRemoteGroupsUseCase(buildGroupsUseCaseDeps(set, get), opts),

  createGroup: (name) => createGroupUseCase(buildGroupsUseCaseDeps(set, get), name),

  joinGroup: (joinCode) => joinGroupUseCase(buildGroupsUseCaseDeps(set, get), joinCode),

  leaveGroup: (groupId) => leaveGroupUseCase(buildGroupsUseCaseDeps(set, get), groupId),

  deleteGroup: (groupId) => deleteGroupUseCase(buildGroupsUseCaseDeps(set, get), groupId),

  fetchGroupWeeklySeries: (groupId) => fetchGroupWeeklySeriesUseCase(buildGroupsUseCaseDeps(set, get), groupId),

  upsertGroupWeeklySeries: (input: UpsertGroupWeeklySeriesInput) =>
    upsertGroupWeeklySeriesUseCase(buildGroupsUseCaseDeps(set, get), input),

  kickGroupMember: (groupId, targetPlayerId) =>
    kickGroupMemberUseCase(buildGroupsUseCaseDeps(set, get), groupId, targetPlayerId),

  setGroupMemberRole: (groupId, targetPlayerId, role) =>
    setGroupMemberRoleUseCase(buildGroupsUseCaseDeps(set, get), groupId, targetPlayerId, role),

  updateGroupPhoto: (groupId, localUri) =>
    updateGroupPhotoUseCase(buildGroupsUseCaseDeps(set, get), groupId, localUri),
});
