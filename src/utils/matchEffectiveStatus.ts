import type { Match } from '../types/domain';
import { isPastMatchEnd } from './matchTiming';

export type EffectiveStatus = 'upcoming' | 'ongoing' | 'finished' | 'cancelled';

/**
 * Maç durumunu view-time'da hesaplar. DB'ye yazmaz; sadece UI kararları için.
 * `status === 'upcoming'` ve maç saati geçmişse 'ongoing' döner.
 * Maç süresi (start + 60 dk) dolduysa 'finished' döner.
 */
export function getEffectiveStatus(
  match: Pick<Match, 'status' | 'startsAt'>,
  nowMs: number = Date.now(),
): EffectiveStatus {
  if (match.status === 'finished' || match.status === 'cancelled') {
    return match.status;
  }
  if (isPastMatchEnd(match.startsAt, nowMs)) {
    return 'finished';
  }
  if (match.status === 'upcoming' && nowMs >= new Date(match.startsAt).getTime()) {
    return 'ongoing';
  }
  return match.status;
}
