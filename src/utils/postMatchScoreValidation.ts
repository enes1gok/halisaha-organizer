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

/**
 * Normal goller takımına yazılır; KK rakibin skoruna eklenir:
 * scoreA = Σ gol(Takım A) + Σ KK(Takım B); scoreB = Σ gol(Takım B) + Σ KK(Takım A).
 * Gol/KK sayısı olan her oyuncu takım kadrosunda olmalı (atanmamış + pozitif sayı → tutarsız).
 */
export function scoreAndStatLinesConsistent(
  scoreA: number,
  scoreB: number,
  teamAIds: readonly string[],
  teamBIds: readonly string[],
  goalsMap: Record<string, number>,
  ownGoalsMap: Record<string, number>,
): boolean {
  const inTeamA = new Set(teamAIds);
  const inTeamB = new Set(teamBIds.filter((id) => !inTeamA.has(id)));

  const inRoster = (playerId: string) => inTeamA.has(playerId) || inTeamB.has(playerId);

  let goalsForA = 0;
  let goalsForB = 0;
  let ogForA = 0;
  let ogForB = 0;

  for (const [playerId, c] of Object.entries(goalsMap)) {
    if (c <= 0) continue;
    if (!inRoster(playerId)) return false;
    if (inTeamA.has(playerId)) goalsForA += c;
    else goalsForB += c;
  }

  for (const [playerId, c] of Object.entries(ownGoalsMap)) {
    if (c <= 0) continue;
    if (!inRoster(playerId)) return false;
    if (inTeamA.has(playerId)) ogForA += c;
    else ogForB += c;
  }

  return scoreA === goalsForA + ogForB && scoreB === goalsForB + ogForA;
}
