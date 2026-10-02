const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** `p_` / `i_` / `w_` / `c_` + 10 random base-36 characters (spec §2.1). */
export function newId(prefix: 'p' | 'i' | 'w' | 'c'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let s = '';
  for (const b of bytes) s += ALPHABET[b % 36];
  return `${prefix}_${s}`;
}
