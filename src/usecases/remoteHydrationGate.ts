import type { RemoteHydrateOpts } from '../types/remoteHydration';

/**
 * Uzak maç / grup listeleri için hafif istemci önbelleği: gereksiz tekrar `fetch` azaltır.
 * TanStack Query eklenmedi; tek durum kaynağı Zustand + persist ([`useAppStore`](../store/useAppStore.ts)).
 * Ayrıca sunucu durumu + istemci önbelleği `RemoteHydrateOpts.force` ve store eylemleriyle birlikte yönetilir;
 * React Query ancak sayfa bazlı otomatik yeniden deneme / penceresi odak refetch gibi gereksinimler netleşirse değerlendirilmelidir.
 */
const MATCH_TTL_MS = 120_000;
const GROUP_TTL_MS = 120_000;
const HYDRATION_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

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
      await withTimeout(execute(), HYDRATION_TIMEOUT_MS, 'hydrateRemoteMatches');
      lastMatchesSuccessAt = Date.now();
    } catch (error) {
      console.warn('hydrateRemoteMatches failed or timed out', error);
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
      await withTimeout(execute(), HYDRATION_TIMEOUT_MS, 'hydrateRemoteGroups');
      lastGroupsSuccessAt = Date.now();
    } catch (error) {
      console.warn('hydrateRemoteGroups failed or timed out', error);
    } finally {
      groupsInflight = null;
    }
  })();
  return groupsInflight;
}
