/**
 * In-memory counters for match-graph RPC paths. Used for ops visibility and
 * high-fallback-rate alerts (console — hook to external telemetry later).
 */

/** Minimum completed operations before emitting a ratio alert (reduces boot noise). */
export const MATCH_GRAPH_ALERT_MIN_TOTAL_SAMPLES = 15;

/** Alert when list RPC fallback ratio exceeds this (0–1). */
export const MATCH_GRAPH_LIST_FALLBACK_RATIO_ALERT = 0.08;

/** Alert when single-match RPC fallback ratio exceeds this (0–1). */
export const MATCH_GRAPH_DETAIL_FALLBACK_RATIO_ALERT = 0.12;

let listRpcSuccessCount = 0;
let listRpcFallbackCount = 0;
let detailRpcSuccessCount = 0;
let detailRpcFallbackCount = 0;

export type MatchGraphRpcHealthSnapshot = {
  listRpcSuccessCount: number;
  listRpcFallbackCount: number;
  detailRpcSuccessCount: number;
  detailRpcFallbackCount: number;
  listFallbackRatio: number | null;
  detailFallbackRatio: number | null;
};

export function getMatchGraphRpcHealthSnapshot(): MatchGraphRpcHealthSnapshot {
  const listTotal = listRpcSuccessCount + listRpcFallbackCount;
  const detailTotal = detailRpcSuccessCount + detailRpcFallbackCount;
  return {
    listRpcSuccessCount,
    listRpcFallbackCount,
    detailRpcSuccessCount,
    detailRpcFallbackCount,
    listFallbackRatio: listTotal > 0 ? listRpcFallbackCount / listTotal : null,
    detailFallbackRatio: detailTotal > 0 ? detailRpcFallbackCount / detailTotal : null,
  };
}

export function recordListMatchGraphRpcSuccess(): void {
  listRpcSuccessCount += 1;
  maybeEmitMatchGraphListFallbackAlert();
}

export function recordListMatchGraphRpcFallback(): void {
  listRpcFallbackCount += 1;
  maybeEmitMatchGraphListFallbackAlert();
}

export function recordDetailMatchGraphRpcSuccess(): void {
  detailRpcSuccessCount += 1;
  maybeEmitMatchGraphDetailFallbackAlert();
}

export function recordDetailMatchGraphRpcFallback(): void {
  detailRpcFallbackCount += 1;
  maybeEmitMatchGraphDetailFallbackAlert();
}

function maybeEmitMatchGraphListFallbackAlert(): void {
  const total = listRpcSuccessCount + listRpcFallbackCount;
  if (total < MATCH_GRAPH_ALERT_MIN_TOTAL_SAMPLES) return;
  const ratio = listRpcFallbackCount / total;
  if (ratio <= MATCH_GRAPH_LIST_FALLBACK_RATIO_ALERT) return;
  console.error('[matchGraph][ALERT] list_visible_match_graphs_for_user fallback ratio high', {
    ratio: Number(ratio.toFixed(4)),
    threshold: MATCH_GRAPH_LIST_FALLBACK_RATIO_ALERT,
    successCount: listRpcSuccessCount,
    fallbackCount: listRpcFallbackCount,
    hint: 'Verify migration deploy, grants, and Supabase logs for list_visible_match_graphs_for_user.',
  });
}

function maybeEmitMatchGraphDetailFallbackAlert(): void {
  const total = detailRpcSuccessCount + detailRpcFallbackCount;
  if (total < MATCH_GRAPH_ALERT_MIN_TOTAL_SAMPLES) return;
  const ratio = detailRpcFallbackCount / total;
  if (ratio <= MATCH_GRAPH_DETAIL_FALLBACK_RATIO_ALERT) return;
  console.error('[matchGraph][ALERT] get_match_graph_for_user fallback ratio high', {
    ratio: Number(ratio.toFixed(4)),
    threshold: MATCH_GRAPH_DETAIL_FALLBACK_RATIO_ALERT,
    successCount: detailRpcSuccessCount,
    fallbackCount: detailRpcFallbackCount,
    hint: 'Verify migration deploy and RPC errors; legacy path uses multiple round-trips per match.',
  });
}
