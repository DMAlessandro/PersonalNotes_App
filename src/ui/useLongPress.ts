import { useRef, type MouseEvent, type PointerEvent } from 'react';

const DELAY = 500;
const SLOP = 10; // px a finger may wander before it counts as a scroll

// Fingers on the screen right now, for the whole app: a second finger (a pinch) cancels any long-press.
const touches = new Set<number>();
/** Goes up whenever a second finger lands; a press that saw it change is not a long-press. */
let pinches = 0;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      // The first finger of a new touch: any finger still counted was lifted without us hearing it.
      if (e.isPrimary) touches.clear();
      touches.add(e.pointerId);
      if (touches.size > 1) pinches++;
    },
    true,
  );
  const lift = (e: globalThis.PointerEvent) => {
    touches.delete(e.pointerId);
  };
  window.addEventListener('pointerup', lift, true);
  window.addEventListener('pointercancel', lift, true);
}

/**
 * Touch screens: holding a finger still on a row for ~0.5 s opens its menu, with a short vibration
 * (spec section 5.3, extended to the List view on 2026-10-02). Mouse and pen are ignored: they have the ⋯ button.
 * Spread the result onto the row. Touches starting on the drag handle, a field or a link are left alone.
 */
export function useLongPress(onLongPress: (el: HTMLElement) => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const touching = useRef(false);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      touching.current = e.pointerType === 'touch';
      fired.current = false;
      if (!touching.current) return;
      if ((e.target as HTMLElement).closest('.handle, textarea, input, a, [role=dialog]')) return;
      const el = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY };
      const seen = pinches;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (touches.size > 1 || pinches !== seen) return;
        fired.current = true;
        navigator.vibrate?.(15);
        onLongPress(el);
      }, DELAY);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // The finger lifting after a long-press is not a tap: don't let it open or tick anything.
    onClickCapture: (e: MouseEvent<HTMLElement>) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // On touch, stop the browser's own long-press menu from competing. Right-click on a laptop is untouched.
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      if (touching.current && !(e.target as HTMLElement).closest('textarea, input, a')) e.preventDefault();
    },
  };
}
