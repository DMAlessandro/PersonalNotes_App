import type { DateOnly, Timestamp } from './model';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Now as ISO 8601 with the device's offset and milliseconds, e.g. 2026-10-02T09:14:00.123+02:00.
 * Milliseconds keep quick successive edits (and Change-log entries) in the order they happened.
 */
export function nowIso(d = new Date()): Timestamp {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** The device's local date, YYYY-MM-DD. */
export function todayLocal(d = new Date()): DateOnly {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
