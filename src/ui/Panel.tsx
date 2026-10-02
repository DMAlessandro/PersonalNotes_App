import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

  // Keyboard: move focus into the panel (unless a field there took it) and give it back when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // Next frame: a popover is hidden until it has been placed, and hidden buttons can't take focus.
    const raf = requestAnimationFrame(() => {
      if (el && !el.contains(document.activeElement)) el.querySelector<HTMLElement>('button, input, select, textarea')?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      // Only if nothing else took focus meanwhile (e.g. "Edit" just opened a text field).
      const now = document.activeElement;
      const free = !now || now === document.body || (el?.contains(now) ?? false);
      if (free && before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Rendered on <body>: inside the zoomed Map a fixed panel would move and scale with the map.
  return createPortal(
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
    </div>,
    document.body,
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
