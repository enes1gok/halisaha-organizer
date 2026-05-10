import type { Match } from '../types/domain';

/** Kadroda iki oyuncu karşı takımlarda mı (A vs B)? */
export function isOpposingLineupPlayerToReporter(
  match: Pick<Match, 'teamAIds' | 'teamBIds'>,
  reporterPlayerId: string,
  viewerPlayerId: string,
): boolean {
  const reporterOnA = match.teamAIds.includes(reporterPlayerId);
  const reporterOnB = match.teamBIds.includes(reporterPlayerId);
  const viewerOnA = match.teamAIds.includes(viewerPlayerId);
  const viewerOnB = match.teamBIds.includes(viewerPlayerId);
  if (!(viewerOnA || viewerOnB)) return false;
  if (!(reporterOnA || reporterOnB)) return false;
  return (reporterOnA && viewerOnB) || (reporterOnB && viewerOnA);
}

/**
 * Yerel SQL `can_respond_to_self_report_request` ile hizalı:
 * organizatör (kadrodaki raporlayana kendi kendine onay yok; kadrosu olmayana organizatör onaylayabilir)
 * veya karşı takım oyuncusu.
 */
export function canRespondToSelfReportRequest(
  match: Match,
  reporterPlayerId: string,
  viewerPlayerId: string,
): boolean {
  const reporterOnLineup =
    match.teamAIds.includes(reporterPlayerId) || match.teamBIds.includes(reporterPlayerId);
  const isOrg = match.organizerId === viewerPlayerId;

  if (isOrg && (reporterPlayerId !== viewerPlayerId || !reporterOnLineup)) {
    return true;
  }

  return (
    reporterPlayerId !== viewerPlayerId &&
    isOpposingLineupPlayerToReporter(match, reporterPlayerId, viewerPlayerId)
  );
}
