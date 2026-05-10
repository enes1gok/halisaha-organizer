/** Bounded concurrency pool — avoids unbounded Promise.all on large lists. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Math.min(Math.max(1, limit), items.length);

  const worker = async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) break;
      out[i] = await mapper(items[i]!, i);
    }
  };

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}
