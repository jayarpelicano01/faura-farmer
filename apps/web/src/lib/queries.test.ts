import { describe, expect, it } from 'vitest';
import { buildBalanceTimelineBuckets } from './queries';

describe('balance timeline buckets', () => {
  const anchor = new Date(2026, 8, 11, 12);

  it('matches the mobile seven-day, thirty-day, and yearly bucket counts', () => {
    expect(buildBalanceTimelineBuckets('7d', anchor)).toHaveLength(7);
    expect(buildBalanceTimelineBuckets('30d', anchor)).toHaveLength(6);
    expect(buildBalanceTimelineBuckets('365d', anchor)).toHaveLength(12);
  });

  it('uses five-day buckets for the thirty-day report', () => {
    const buckets = buildBalanceTimelineBuckets('30d', anchor);
    expect(buckets[0]?.id).toBe('2026-08-17');
    expect(buckets.at(-1)?.id).toBe('2026-09-11');
  });
});
