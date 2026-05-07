import type { GroupWeeklySeries } from '../../types/domain';
import { getSupabaseClient } from '../../lib/supabase';
import { createAuthRequiredError, mapSupabaseError } from './errors';
import { mapGroupWeeklySeries } from './mappers';
import type { GroupWeeklySeriesRow } from './types';

export async function fetchGroupWeeklySeries(groupId: string): Promise<GroupWeeklySeries | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('group_weekly_series')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) throw mapSupabaseError(error, 'fetchGroupWeeklySeries');
  if (!data) return null;
  return mapGroupWeeklySeries(data as GroupWeeklySeriesRow);
}

export type UpsertGroupWeeklySeriesInput = {
  groupId: string;
  isActive: boolean;
  weekdayIsodow: number;
  /** `HH:mm` or `HH:mm:ss` (24h). */
  localTime: string;
  timezone?: string;
  venue: string;
  maxPlayers: number;
  pricePerPerson?: number | null;
  iban?: string | null;
  defaultOrganizerId: string;
};

function normalizeLocalTime(t: string): string {
  const s = t.trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

export async function upsertGroupWeeklySeriesRemote(input: UpsertGroupWeeklySeriesInput): Promise<GroupWeeklySeries> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw createAuthRequiredError('upsertGroupWeeklySeriesRemote');

  const row = {
    group_id: input.groupId,
    is_active: input.isActive,
    weekday_isodow: input.weekdayIsodow,
    local_time: normalizeLocalTime(input.localTime),
    timezone: input.timezone?.trim() || 'Europe/Istanbul',
    venue: input.venue.trim(),
    max_players: input.maxPlayers,
    price_per_person: input.pricePerPerson ?? null,
    iban: input.iban?.trim() || null,
    default_organizer_id: input.defaultOrganizerId,
  };

  const { data, error } = await supabase
    .from('group_weekly_series')
    .upsert(row, { onConflict: 'group_id' })
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error, 'upsertGroupWeeklySeriesRemote');
  return mapGroupWeeklySeries(data as GroupWeeklySeriesRow);
}
