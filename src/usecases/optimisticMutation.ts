import type { Match, Player } from '../types/domain';

export interface OptimisticMatchOpts {
  applyOptimistic: () => void;
  rpc: () => Promise<unknown>;
  getSnapshot: () => Match[];
  restoreSnapshot: (snapshot: Match[]) => void;
  /** Provide when the optimistic mutator also updates player stats. */
  getPlayersSnapshot?: () => Player[];
  restorePlayersSnapshot?: (snapshot: Player[]) => void;
}

/**
 * Optimistic UI wrapper for remote match mutations.
 *
 * Applies the local state change immediately, runs the RPC in the background,
 * and restores the pre-mutation snapshot if the RPC throws. The caller is
 * responsible for re-throwing so screens can surface error feedback.
 *
 * Realtime debounce (320 ms) reconciles server truth after RPC succeeds —
 * no fetchMatchGraph call needed here.
 */
export async function withOptimisticMatch(opts: OptimisticMatchOpts): Promise<void> {
  const matchSnapshot = opts.getSnapshot();
  const playerSnapshot = opts.getPlayersSnapshot?.();
  opts.applyOptimistic();
  try {
    await opts.rpc();
  } catch (error) {
    opts.restoreSnapshot(matchSnapshot);
    if (playerSnapshot !== undefined) {
      opts.restorePlayersSnapshot?.(playerSnapshot);
    }
    throw error;
  }
}
