import { describe, expect, it } from 'vitest';
import { nowIso, todayLocal } from './time';

describe('nowIso', () => {
  it('writes local time with milliseconds and the offset, and parses back to the same instant', () => {
    const d = new Date(2026, 9, 2, 9, 14, 5, 7);
    const s = nowIso(d);
    expect(s).toMatch(/^2026-10-02T09:14:05\.007[+-]\d\d:\d\d$/);
    expect(Date.parse(s)).toBe(d.getTime());
    expect(todayLocal(d)).toBe('2026-10-02');
  });
});
