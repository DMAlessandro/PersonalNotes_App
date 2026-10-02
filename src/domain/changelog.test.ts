import { describe, expect, it } from 'vitest';
import { groupByWeek, isoWeekKey, weekLabel } from './changelog';
import type { LogEntry } from './model';

describe('ISO week of a timestamp (spec §3.3)', () => {
  it.each([
    ['2026-10-02T09:00:00+02:00', '2026-W40'],
    ['2026-09-28T00:10:00+02:00', '2026-W40'], // Monday
    ['2026-09-27T23:50:00+02:00', '2026-W39'], // Sunday
    ['2027-01-01T12:00:00+01:00', '2026-W53'], // 2026 has 53 weeks
    ['2024-12-30T12:00:00+01:00', '2025-W01'],
    ['2026-01-05T08:00:00+01:00', '2026-W02'],
  ])('%s is %s', (ts, key) => {
    expect(isoWeekKey(ts)).toBe(key);
  });
});

describe('week labels', () => {
  const today = '2026-10-02';
  it('says This week, Last week, then Week NN (with the year when it differs)', () => {
    expect(weekLabel('2026-W40', today)).toBe('This week');
    expect(weekLabel('2026-W39', today)).toBe('Last week');
    expect(weekLabel('2026-W38', today)).toBe('Week 38');
    expect(weekLabel('2025-W52', today)).toBe('Week 52, 2025');
    expect(weekLabel('2026-W01', '2026-01-02')).toBe('This week');
    expect(weekLabel('2025-W52', '2026-01-02')).toBe('Last week'); // across the year boundary (2026-W01 starts 29 Dec 2025)
  });
});

describe('grouping', () => {
  const e = (id: string, at: string) => ({ id, at }) as LogEntry;
  it('groups by week, newest week first and newest entry first', () => {
    const groups = groupByWeek([e('a', '2026-09-21T10:00:00+02:00'), e('b', '2026-10-01T10:00:00+02:00'), e('c', '2026-10-02T08:00:00+02:00')]);
    expect(groups.map((g) => [g.week, g.entries.map((x) => x.id)])).toEqual([
      ['2026-W40', ['c', 'b']],
      ['2026-W39', ['a']],
    ]);
  });

  it('orders by real time: milliseconds count, and different offsets (e.g. across a clock change) compare correctly', () => {
    const [g] = groupByWeek([
      e('first', '2026-10-02T10:33:05.100+02:00'),
      e('third', '2026-10-02T09:33:05.900+01:00'), // = 10:33:05.900 at +02:00
      e('second', '2026-10-02T10:33:05.400+02:00'),
    ]);
    expect(g.entries.map((x) => x.id)).toEqual(['third', 'second', 'first']);
  });
});
