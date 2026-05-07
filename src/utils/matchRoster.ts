import type { Match, Player } from '../types/domain';

export function countGoing(m: Match): number {
  return m.attendees.filter((a) => a.status === 'going').length;
}

/** Kaleci pozisyonundaki ve "going" olan katılımcı sayısı */
export function countGoalkeepersAmongGoing(
  m: Match,
  getPlayer: (id: string) => Player | undefined,
): number {
  let n = 0;
  for (const a of m.attendees) {
    if (a.status !== 'going') continue;
    const p = getPlayer(a.playerId);
    if (p?.position === 'GK') n += 1;
  }
  return n;
}

/** Tam kadroya kalan boş slot (going sayısına göre) */
export function rosterMissingSlots(m: Match, goingCount: number): number {
  return Math.max(0, m.maxPlayers - goingCount);
}
