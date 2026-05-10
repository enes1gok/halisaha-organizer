import type { RemoteHydrateOpts } from '../types/remoteHydration';

/**
 * Uzak maç / grup listeleri için hafif istemci önbelleği: gereksiz tekrar `fetch` azaltır.
 * TanStack Query eklenmedi; tek durum kaynağı Zustand + persist ([`useAppStore`](../store/useAppStore.ts)).
 * Ayrıca sunucu durumu + istemci önbelleği `RemoteHydrateOpts.force` ve store eylemleriyle birlikte yönetilir;
 * React Query ancak sayfa bazlı otomatik yeniden deneme / penceresi odak refetch gibi gereksinimler netleşirse değerlendirilmelidir.
 */
const MATCH_TTL_MS = 60_000;
const GROUP_TTL_MS = 60_000;

let lastMatchesSuccessAt = 0;
let lastGroupsSuccessAt = 0;
let matchesInflight: Promise<void> | null = null;
let groupsInflight: Promise<void> | null = null;

function shouldRun(ttlMs: number, lastOk: number, opts: RemoteHydrateOpts | undefined): boolean {
  if (opts?.force) return true;
  return Date.now() - lastOk >= ttlMs;
}

export function resetRemoteHydrationGates(): void {
  lastMatchesSuccessAt = 0;
  lastGroupsSuccessAt = 0;
  matchesInflight = null;
  groupsInflight = null;
}

export async function runGatedMatchesHydration(
  opts: RemoteHydrateOpts | undefined,
  execute: () => Promise<void>,
): Promise<void> {
  if (!shouldRun(MATCH_TTL_MS, lastMatchesSuccessAt, opts)) {
    return;
  }
  if (matchesInflight) {
    return matchesInflight;
  }
  matchesInflight = (async () => {
    try {
      await execute();
      lastMatchesSuccessAt = Date.now();
    } finally {
      matchesInflight = null;
    }
  })();
  return matchesInflight;
}

export async function runGatedGroupsHydration(
  opts: RemoteHydrateOpts | undefined,
  execute: () => Promise<void>,
): Promise<void> {
  if (!shouldRun(GROUP_TTL_MS, lastGroupsSuccessAt, opts)) {
    return;
  }
  if (groupsInflight) {
    return groupsInflight;
  }
  groupsInflight = (async () => {
    try {
      await execute();
      lastGroupsSuccessAt = Date.now();
    } finally {
      groupsInflight = null;
    }
  })();
  return groupsInflight;
}
