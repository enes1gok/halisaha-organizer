import type { StateCreator } from 'zustand';
import type { Group, GroupMembership, GroupWeeklySeries } from '../../types/domain';
import {
  buildLocalGroup,
  createGroupUseCase,
  deleteGroupUseCase,
  fetchGroupWeeklySeriesUseCase,
  hydrateRemoteGroupsUseCase,
  joinGroupUseCase,
  leaveGroupUseCase,
  upsertGroupWeeklySeriesUseCase,
} from '../../usecases/groups';
import type { UpsertGroupWeeklySeriesInput } from '../../services/supabase/groupWeeklySeries';
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
    hydrateLocalGroups: (payload: { groups: Group[]; memberships: GroupMembership[] }) =>
      hydrateGroupsState(set, payload),
    createLocalGroup: (name: string) => createLocalGroup(set, get, name),
    joinLocalGroup: (joinCode: string) => joinLocalGroup(set, get, joinCode),
    leaveLocalGroup: (groupId: string) => leaveLocalGroup(set, get, groupId),
    deleteLocalGroupState: (groupId: string) => deleteLocalGroupState(set, groupId),
    hydrateRemoteMatches: () => get().hydrateRemoteMatches(),
    setWeeklySeriesCache: (groupId: string, series: GroupWeeklySeries | null) =>
      set((s) => ({
        weeklySeriesByGroupId: { ...s.weeklySeriesByGroupId, [groupId]: series },
      })),
  };
}

export const createGroupsSlice: StateCreator<AppState, [], [], GroupsSlice> = (set, get) => ({
  groups: [],
  groupMemberships: [],
  weeklySeriesByGroupId: {},

  hydrateRemoteGroups: () => hydrateRemoteGroupsUseCase(buildGroupsUseCaseDeps(set, get)),

  createGroup: (name) => createGroupUseCase(buildGroupsUseCaseDeps(set, get), name),

  joinGroup: (joinCode) => joinGroupUseCase(buildGroupsUseCaseDeps(set, get), joinCode),

  leaveGroup: (groupId) => leaveGroupUseCase(buildGroupsUseCaseDeps(set, get), groupId),

  deleteGroup: (groupId) => deleteGroupUseCase(buildGroupsUseCaseDeps(set, get), groupId),

  fetchGroupWeeklySeries: (groupId) => fetchGroupWeeklySeriesUseCase(buildGroupsUseCaseDeps(set, get), groupId),

  upsertGroupWeeklySeries: (input: UpsertGroupWeeklySeriesInput) =>
    upsertGroupWeeklySeriesUseCase(buildGroupsUseCaseDeps(set, get), input),
});
