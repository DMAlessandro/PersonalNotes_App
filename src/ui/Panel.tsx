import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useWide } from './useWide';

type Props = {
  /** The button that opened it: on a laptop the panel pops up next to it. Without one, or on a phone, it is a bottom panel. */
  anchor?: DOMRect | null;
  onClose: () => void;
  children: ReactNode;
  label: string;
};

/** Menus, date picker and confirmations: bottom panel on touch-size screens, popover on a laptop (spec §5.3). */
export function Panel({ anchor, onClose, children, label }: Props) {
  const wide = useWide();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const popover = wide && !!anchor;

  useLayoutEffect(() => {
    if (!popover || !ref.current || !anchor) return;
    const r = ref.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.right - r.width, window.innerWidth - r.width - 8));
    const below = anchor.bottom + 4;
    const top = below + r.height > window.innerHeight - 8 ? Math.max(8, anchor.top - r.height - 4) : below;
    setPos({ left, top });
  }, [popover, anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={popover ? 'backdrop clear' : 'backdrop'} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        className={popover ? 'popover' : 'sheet'}
        style={popover ? (pos ?? { visibility: 'hidden' }) : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export type MenuEntry = { label: string; onSelect: () => void; danger?: boolean } | null | false;

export function Menu({ entries, onClose }: { entries: MenuEntry[]; onClose: () => void }) {
  return (
    <div className="menu" role="menu">
      {entries.filter(Boolean).map((e) => {
        const m = e as Exclude<MenuEntry, null | false>;
        return (
          <button
            key={m.label}
            role="menuitem"
            className={m.danger ? 'danger' : undefined}
            onClick={() => {
              onClose();
              m.onSelect();
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
