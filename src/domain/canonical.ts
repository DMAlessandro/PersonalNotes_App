/**
 * JSON with object keys sorted at every level, so two records with the same values compare equal
 * whatever order their fields were created in (records read from the repo have sorted keys; records
 * made on the device do not). Use it for every "did this change?" comparison.
 */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
      : x,
  );
}
