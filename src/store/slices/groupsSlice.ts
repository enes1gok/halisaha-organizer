import type { StateCreator } from 'zustand';
import type { Group, GroupMembership } from '../../types/domain';
import { createGroupRemote, fetchMyGroups, joinGroupRemote, leaveGroupRemote } from '../../services/supabase/groups';
import { createJoinCode } from '../../data/seed';
import { createId } from '../../utils/id';
import type { AppState, GroupsSlice } from '../types';

export const createGroupsSlice: StateCreator<AppState, [], [], GroupsSlice> = (set, get) => ({
  groups: [],
  groupMemberships: [],

  hydrateRemoteGroups: async () => {
    if (!get().remoteUserId) return;
    const payload = await fetchMyGroups();
    set({ groups: payload.groups, groupMemberships: payload.memberships });
  },

  createGroup: async (name) => {
    const uid = get().remoteUserId;
    if (uid) {
      const group = await createGroupRemote(name);
      await get().hydrateRemoteGroups();
      return group;
    }
    const localGroup: Group = {
      id: createId('group'),
      name,
      ownerId: get().getCurrentUserId(),
      joinCode: createJoinCode(),
      createdAt: new Date().toISOString(),
    };
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
  },

  joinGroup: async (joinCode) => {
    const uid = get().remoteUserId;
    if (uid) {
      const joined = await joinGroupRemote(joinCode);
      await get().hydrateRemoteGroups();
      return joined;
    }
    const compact = joinCode.replace(/[\s-]/g, '').toUpperCase();
    const state = get();
    const found = state.groups.find(
      (group) => group.joinCode.replace(/[\s-]/g, '').toUpperCase() === compact,
    );
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
  },

  leaveGroup: async (groupId) => {
    const uid = get().remoteUserId;
    if (uid) {
      await leaveGroupRemote(groupId);
      await get().hydrateRemoteGroups();
      return;
    }
    const currentUserId = get().getCurrentUserId();
    set((state) => ({
      groupMemberships: state.groupMemberships.filter(
        (membership) => !(membership.groupId === groupId && membership.playerId === currentUserId),
      ),
    }));
  },
});
