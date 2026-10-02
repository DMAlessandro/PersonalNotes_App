// Fractional order keys (spec §7): strings that sort in the manual order, so an Item can be placed
// between two others by changing only its own key. Digits are 0-9A-Za-z, compared as plain strings.
// Keys never end in '0', which guarantees there is always room below any key.

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const val = (c: string) => DIGITS.indexOf(c);

/** A key strictly between `lo` and `hi` (either may be null = open end). */
export function keyBetween(lo: string | null, hi: string | null): string {
  const a = lo ?? '';
  let b = hi;
  if (b !== null && a >= b) throw new Error(`keyBetween: ${a} is not below ${b}`);
  let out = '';
  for (let i = 0; ; i++) {
    const da = i < a.length ? val(a[i]) : 0;
    const db = b !== null && i < b.length ? val(b[i]) : BASE;
    if (da === db) {
      out += DIGITS[da];
    } else if (db - da > 1) {
      return out + DIGITS[Math.floor((da + db) / 2)];
    } else {
      // Adjacent digits: take the lower one; from here on anything above `a` fits under `b`.
      out += DIGITS[da];
      b = null;
    }
  }
}

/** n ascending keys after `lo` (null = from the start). */
export function keysAfter(lo: string | null, n: number): string[] {
  const out: string[] = [];
  let k = lo;
  for (let i = 0; i < n; i++) out.push((k = keyBetween(k, null)));
  return out;
}
