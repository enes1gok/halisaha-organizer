/**
 * Sums goal/assist counts from the same shape used by {@link toScoreLines} in PostMatchScoreForm:
 * only strictly positive entries contribute (matches persisted stat lines).
 */
export function totalGoalsFromStatMap(map: Record<string, number>): number {
  let sum = 0;
  for (const c of Object.values(map)) {
    if (c > 0) sum += c;
  }
  return sum;
}

export function goalsTotalMatchesScore(
  scoreA: number,
  scoreB: number,
  goalsMap: Record<string, number>,
): boolean {
  return scoreA + scoreB === totalGoalsFromStatMap(goalsMap);
}
