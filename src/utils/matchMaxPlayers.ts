/** Create-match / DB aligned bounds (`matches_max_players_chk`). */
export const MATCH_MAX_PLAYERS_MIN = 4;
export const MATCH_MAX_PLAYERS_MAX = 22;

/**
 * Sıkıştırır [MATCH_MAX_PLAYERS_MIN, MATCH_MAX_PLAYERS_MAX] ve en yakın çift tam sayıya yuvarlar.
 */
export function clampEvenMatchMaxPlayers(n: number): number {
  const clamped = Math.min(
    MATCH_MAX_PLAYERS_MAX,
    Math.max(MATCH_MAX_PLAYERS_MIN, Math.round(n)),
  );
  return Math.round(clamped / 2) * 2;
}
