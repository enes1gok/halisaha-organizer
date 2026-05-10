import type { LineupFormation } from '../data/lineupFormations';
import type { Player, Position } from '../types/domain';

/** Nötr etkin reyting — `ratingAverage100` yokken (0–100 hızlı bant ölçeğiyle uyumlu). */
export const DEFAULT_EFFECTIVE_RATING = 50;

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

function clampRating100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Oyuncunun maç içi dengelemede kullanılan etkin reytingi (0–100). */
export function effectiveRating(player: Player): number {
  const raw = player.stats.ratingAverage100;
  if (raw == null || Number.isNaN(raw)) return DEFAULT_EFFECTIVE_RATING;
  return clampRating100(raw);
}

/** Yüksek reyting önce; eşitlikte `id` ile deterministik. */
export function comparePlayersByRatingDescStable(a: Player, b: Player): number {
  const ra = effectiveRating(a);
  const rb = effectiveRating(b);
  if (rb !== ra) return rb - ra;
  return a.id.localeCompare(b.id);
}

/** Şablonda yerleşim sırası — mevcut Kadro Kur ile uyumlu (GK → FWD, sonra isim). */
export function comparePlayersForSlotFill(a: Player, b: Player): number {
  const ia = POSITION_ORDER.indexOf(a.position);
  const ib = POSITION_ORDER.indexOf(b.position);
  if (ia !== ib) return ia - ib;
  return a.name.localeCompare(b.name);
}

/**
 * Kapasite kısıtlı greedy: takım boyutları önceden sabit (çift n → eşit; tek n → A bir fazla).
 * Her adımda daha düşük toplam etkin reytinge sahip (ve yer kalan) takıma atanır.
 */
export function balancePlayerIdsIntoTwoTeams(players: Player[]): { A: string[]; B: string[] } {
  const n = players.length;
  if (n === 0) return { A: [], B: [] };

  const capA = Math.ceil(n / 2);
  const capB = Math.floor(n / 2);

  const sorted = [...players].sort(comparePlayersByRatingDescStable);

  let sumA = 0;
  let sumB = 0;
  let remA = capA;
  let remB = capB;
  const teamA: string[] = [];
  const teamB: string[] = [];

  for (const p of sorted) {
    const r = effectiveRating(p);
    const canA = remA > 0;
    const canB = remB > 0;
    if (canA && !canB) {
      teamA.push(p.id);
      sumA += r;
      remA -= 1;
    } else if (!canA && canB) {
      teamB.push(p.id);
      sumB += r;
      remB -= 1;
    } else if (canA && canB) {
      if (sumA < sumB || (sumA === sumB && teamA.length <= teamB.length)) {
        teamA.push(p.id);
        sumA += r;
        remA -= 1;
      } else {
        teamB.push(p.id);
        sumB += r;
        remB -= 1;
      }
    }
  }

  return { A: teamA, B: teamB };
}

/**
 * Kadro taşması: sahada en fazla `2 * playersPerTeam` oyuncu.
 * Reytingi yüksek olanlar sahada kalır (deterministik sıralama).
 */
export function selectPlayersForFormationField(
  players: Player[],
  playersPerTeam: number,
): Player[] {
  const maxOnField = playersPerTeam * 2;
  const sorted = [...players].sort(comparePlayersByRatingDescStable);
  return sorted.slice(0, Math.min(sorted.length, maxOnField));
}

/**
 * Klasik iki alan modu: tüm katılımcılar iki takıma dengelenir (boyut |A−B| ≤ 1).
 */
export function balanceClassicTeamsByRating(players: Player[]): { A: string[]; B: string[] } {
  return balancePlayerIdsIntoTwoTeams(players);
}

function fillSlotsForOneTeam(teamPlayers: Player[], slotCount: number): (string | null)[] {
  const slots: (string | null)[] = Array.from({ length: slotCount }, () => null);
  const ordered = [...teamPlayers].sort(comparePlayersForSlotFill);
  ordered.forEach((p, i) => {
    if (i < slotCount) slots[i] = p.id;
  });
  return slots;
}

/**
 * Formasyon modu: önce sahaya `2P` seçimi, sonra iki takıma reyting dengesi, sonra pozisyona göre slot doldurma.
 */
export function balanceFormationSlotsByRating(
  players: Player[],
  formation: LineupFormation,
): { slotsA: (string | null)[]; slotsB: (string | null)[] } {
  const n = formation.playersPerTeam;
  const fieldPlayers = selectPlayersForFormationField(players, n);
  const { A: idsA, B: idsB } = balancePlayerIdsIntoTwoTeams(fieldPlayers);

  const byId = new Map(fieldPlayers.map((p) => [p.id, p] as const));
  const teamA = idsA.map((id) => byId.get(id)).filter((p): p is Player => p != null);
  const teamB = idsB.map((id) => byId.get(id)).filter((p): p is Player => p != null);

  return {
    slotsA: fillSlotsForOneTeam(teamA, n),
    slotsB: fillSlotsForOneTeam(teamB, n),
  };
}
