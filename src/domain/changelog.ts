// Spec §3.3 / §5.5: Change-log weeks. Entries live in one map; weeks are derived from each entry's `at`.
import type { DateOnly, LogEntry, Timestamp } from './model';

const DAY = 86_400_000;

/** ISO week year and number of a calendar date. */
function isoWeek(date: DateOnly): { year: number; week: number } {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(t + (3 - dow) * DAY);
  const year = thursday.getUTCFullYear();
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY));
  return { year, week };
}

/** `2026-W40`: the week file an entry belongs to. Uses the device's local date written in the timestamp. */
export function isoWeekKey(ts: Timestamp | DateOnly): string {
  const { year, week } = isoWeek(ts.slice(0, 10));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** "This week", "Last week", "Week 38", or "Week 52, 2025" for another year. */
export function weekLabel(key: string, today: DateOnly): string {
  if (key === isoWeekKey(today)) return 'This week';
  const lastWeek = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) - 7 * DAY)
    .toISOString()
    .slice(0, 10);
  if (key === isoWeekKey(lastWeek)) return 'Last week';
  const [year, week] = key.split('-W');
  return year === isoWeekKey(today).slice(0, 4) ? `Week ${+week}` : `Week ${+week}, ${year}`;
}

/** Newest week first, newest entry first within a week. */
export function groupByWeek(entries: LogEntry[]): { week: string; entries: LogEntry[] }[] {
  // Real time, not string order: timestamps carry the device's offset, which can differ between entries.
  const sorted = [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const groups: { week: string; entries: LogEntry[] }[] = [];
  for (const e of sorted) {
    const week = isoWeekKey(e.at);
    if (groups.at(-1)?.week !== week) groups.push({ week, entries: [] });
    groups.at(-1)!.entries.push(e);
  }
  return groups.sort((a, b) => (a.week < b.week ? 1 : -1));
}
