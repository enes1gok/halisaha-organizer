import type { Group, GroupMembership } from '../../types/domain';
import { getSupabaseClient } from '../../lib/supabase';
import { createAuthRequiredError, mapSupabaseError } from './errors';
import { mapGroup, mapMembership } from './mappers';
import type { GroupMemberRow, GroupRow } from './types';

export async function fetchMyGroups(): Promise<{ groups: Group[]; memberships: GroupMembership[] }> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { groups: [], memberships: [] };

  const { data: membershipsRaw, error: membershipsError } = await supabase
    .from('group_members')
    .select('*')
    .eq('player_id', user.id);
  if (membershipsError) throw mapSupabaseError(membershipsError, 'fetchMyGroups.memberships');

  const memberships = (membershipsRaw ?? []).map((row) => mapMembership(row as GroupMemberRow));
  const groupIds = memberships.map((item) => item.groupId);
  if (groupIds.length === 0) return { groups: [], memberships };

  const { data: groupsRaw, error: groupsError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds);
  if (groupsError) throw mapSupabaseError(groupsError, 'fetchMyGroups.groups');

  return {
    groups: (groupsRaw ?? []).map((row) => mapGroup(row as GroupRow)),
    memberships,
  };
}

export async function createGroupRemote(name: string): Promise<Group> {
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
