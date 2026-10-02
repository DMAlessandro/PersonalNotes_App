import type { ReactNode } from 'react';
import type { DateOnly, Timestamp } from '../domain/model';
import { todayLocal } from '../domain/time';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10 Oct", or "10 Oct 2027" outside the current year. */
export function shortDate(d: DateOnly | Timestamp): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  const year = y === new Date().getFullYear() ? '' : ` ${y}`;
  return `${day} ${MONTHS[m - 1]}${year}`;
}

export type DueState = 'overdue' | 'today' | 'later';

export function dueState(due: DateOnly, today = todayLocal()): DueState {
  return due < today ? 'overdue' : due === today ? 'today' : 'later';
}

export function DueChip({ due, muted }: { due: DateOnly; muted?: boolean }) {
  return <span className={`chip due-${muted ? 'muted' : dueState(due)}`}>{shortDate(due)}</span>;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/** Plain text with URLs made clickable (spec §2.1: text is plain, links clickable). */
export function Linkified({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a key={m.index} href={m[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {m[0]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
