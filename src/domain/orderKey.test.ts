import { describe, expect, it } from 'vitest';
import { keyBetween, keysAfter } from './orderKey';

describe('keyBetween', () => {
  it('makes a first key', () => {
    expect(keyBetween(null, null)).toBeTypeOf('string');
  });

  it('sorts after, before and between existing keys', () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    const c = keyBetween(null, a);
    const m = keyBetween(a, b);
    expect([b, m, c, a].sort()).toEqual([c, a, m, b]);
  });

  it('keeps finding room after many inserts at the same spot', () => {
    let lo = keyBetween(null, null);
    const hi = keyBetween(lo, null);
    for (let i = 0; i < 200; i++) {
      const k = keyBetween(lo, hi);
      expect(lo < k && k < hi).toBe(true);
      lo = k;
    }
    let top = keyBetween(null, null);
    for (let i = 0; i < 200; i++) {
      const k = keyBetween(null, top);
      expect(k < top).toBe(true);
      top = k;
    }
  });

  it('survives random inserts with keys always strictly ordered', () => {
    const keys: string[] = [keyBetween(null, null)];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 500; i++) {
      const at = Math.floor(rnd() * (keys.length + 1));
      const k = keyBetween(keys[at - 1] ?? null, keys[at] ?? null);
      keys.splice(at, 0, k);
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('rejects a lower bound that is not below the upper bound', () => {
    expect(() => keyBetween('b', 'a')).toThrow();
  });
});

describe('keysAfter', () => {
  it('makes n ascending keys after a key', () => {
    const ks = keysAfter('V', 3);
    expect(ks).toHaveLength(3);
    expect(['V', ...ks]).toEqual(['V', ...ks].sort());
  });
});
