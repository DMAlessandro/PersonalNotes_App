import type { ReactNode } from 'react';
import { useUi } from '../store/ui';

/**
 * Ticket 14: the crossed-out Items (or Projects) of one level, under a pale line with an arrow.
 * Folded by default; clicking the line shows them. Nothing is drawn when the level has none.
 */
export function CrossedSection({ id, count, as: Tag = 'div', children }: { id: string; count: number; as?: 'div' | 'li'; children: ReactNode }) {
  const open = useUi((s) => s.crossedOpen.has(id));
  const toggle = useUi((s) => s.toggleCrossed);
  if (!count) return null;
  const label = `${open ? 'Hide' : 'Show'} ${count} crossed out`;
  return (
    <>
      <Tag className="crossed-line">
        <button className="crossed-divider" aria-expanded={open} aria-label={label} title={label} onClick={() => toggle(id)}>
          <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      </Tag>
      {open && children}
    </>
  );
}
