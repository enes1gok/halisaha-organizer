import type { Match } from '../types/domain';

/** Oyuncu kadroda değilse veya maç skoru yoksa `null`. */
export function getPlayerMatchOutcome(
  match: Match,
  playerId: string,
): 'W' | 'L' | 'D' | null {
  if (match.status !== 'finished' || !match.result) return null;
  const r = match.result;
  const inA = match.teamAIds.includes(playerId);
  const inB = match.teamBIds.includes(playerId);
  if (!inA && !inB) return null;
  if (r.scoreA === r.scoreB) return 'D';
  if (inA) return r.scoreA > r.scoreB ? 'W' : 'L';
  return r.scoreB > r.scoreA ? 'W' : 'L';
}

/** Kadroda yer alınan, skoru olan en son bitmiş maç (tarih azalan). */
export function getLastFinishedMatchForPlayer(
  matches: Match[],
  playerId: string,
): Match | null {
  const eligible = matches.filter(
    (m) =>
      m.status === 'finished' &&
      m.result &&
      (m.teamAIds.includes(playerId) || m.teamBIds.includes(playerId)),
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return eligible[0] ?? null;
}
