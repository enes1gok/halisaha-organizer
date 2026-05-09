/** Varsayılan halısaha süresi (DB’de ayrı bitiş alanı yok; `startsAt + süre`). */
export const MATCH_DURATION_MINUTES = 60;

export function getMatchEndsAtIso(startsAt: string): string {
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) {
    return startsAt;
  }
  return new Date(start + MATCH_DURATION_MINUTES * 60 * 1000).toISOString();
}

export function isPastMatchEnd(startsAt: string, nowMs: number = Date.now()): boolean {
  const end = new Date(getMatchEndsAtIso(startsAt)).getTime();
  if (Number.isNaN(end)) {
    return false;
  }
  return nowMs >= end;
}
