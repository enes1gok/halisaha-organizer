import { mapWithConcurrency } from '../asyncPool';

describe('mapWithConcurrency', () => {
  it('runs all tasks with bounded concurrency', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent -= 1;
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
