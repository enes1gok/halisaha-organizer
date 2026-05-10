import type { Group, GroupMembership } from '../../types/domain';
import { getSupabaseClient } from '../../lib/supabase';
import { createAuthRequiredError, generateTraceId, mapSupabaseError } from './errors';
import { ensureMyProfile, fetchProfilesByIds } from './profiles';
import { mapGroup, mapMembership } from './mappers';
import type { GroupMemberRow, GroupRow, PublicProfileRow } from './types';

export type MyGroupsPayload = {
  groups: Group[];
  memberships: GroupMembership[];
  profiles: PublicProfileRow[];
};

async function fetchMyGroupsViaMultiQuery(userId: string): Promise<MyGroupsPayload> {
  const supabase = getSupabaseClient();

  const { data: myMembershipsRaw, error: myMembershipsError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('player_id', userId);
  if (myMembershipsError) throw mapSupabaseError(myMembershipsError, 'fetchMyGroups.myMemberships');

  const groupIds = [...new Set((myMembershipsRaw ?? []).map((item) => item.group_id).filter(Boolean))];
  if (groupIds.length === 0) return { groups: [], memberships: [], profiles: [] };

  const [groupsResult, membershipsResult] = await Promise.all([
    supabase
      .from('groups')
      .select('id,name,owner_id,join_code,created_at')
      .in('id', groupIds),
    supabase
      .from('group_members')
      .select('group_id,player_id,role,created_at')
      .in('group_id', groupIds),
  ]);

  const { data: groupsRaw, error: groupsError } = groupsResult;
  if (groupsError) throw mapSupabaseError(groupsError, 'fetchMyGroups.groups');

  const { data: membershipsRaw, error: membershipsError } = membershipsResult;
  if (membershipsError) throw mapSupabaseError(membershipsError, 'fetchMyGroups.memberships');

  const memberships = (membershipsRaw ?? []).map((row) => mapMembership(row as GroupMemberRow));
  const profileIds = memberships.map((item) => item.playerId);

  return {
    groups: (groupsRaw ?? []).map((row) => mapGroup(row as GroupRow)),
    memberships,
    profiles: await fetchProfilesByIds(profileIds),
  };
}

export async function fetchMyGroups(): Promise<MyGroupsPayload> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { groups: [], memberships: [], profiles: [] };

  const { data, error } = await supabase.rpc('get_my_groups_bundle_for_user');
  if (!error && data != null && typeof data === 'object') {
    const bundle = data as {
      groups?: unknown;
      memberships?: unknown;
      profiles?: unknown;
    };
    if (
      Array.isArray(bundle.groups) &&
      Array.isArray(bundle.memberships) &&
      Array.isArray(bundle.profiles)
    ) {
      return {
        groups: bundle.groups.map((row) => mapGroup(row as GroupRow)),
        memberships: bundle.memberships.map((row) => mapMembership(row as GroupMemberRow)),
        profiles: bundle.profiles as PublicProfileRow[],
      };
    }
  }

  if (error) {
    console.warn('[groups] get_my_groups_bundle_for_user failed; using multi-query path', {
      code: error.code,
      message: error.message,
    });
  }

  return fetchMyGroupsViaMultiQuery(user.id);
}

export async function createGroupRemote(name: string): Promise<Group> {
  await ensureMyProfile();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_group', { p_name: name });
  if (error) throw mapSupabaseError(error, 'createGroupRemote');
  return mapGroup(data as GroupRow);
}

export async function joinGroupRemote(joinCode: string): Promise<Group | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('join_group_by_code', { p_code: joinCode });
  if (error) throw mapSupabaseError(error, 'joinGroupRemote');
  if (!data) return null;
  return mapGroup(data as GroupRow);
}

export async function leaveGroupRemote(groupId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw createAuthRequiredError('leaveGroupRemote');
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('player_id', user.id);
  if (error) throw mapSupabaseError(error, 'leaveGroupRemote');
}

/** Grubu `delete_group` RPC ile siler; yetki/ bulunamadı ERR_* tokenleriyle ayrışır. */
export async function deleteGroupRemote(groupId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw createAuthRequiredError('deleteGroupRemote');
  const traceId = generateTraceId();
  const { error } = await supabase.rpc('delete_group', { p_group_id: groupId });
  if (error) {
    throw mapSupabaseError(error, 'deleteGroupRemote', {
      traceId,
      requestPayload: { groupId },
    });
  }
}
