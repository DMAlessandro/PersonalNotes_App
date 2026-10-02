import { useCallback, type PointerEvent } from 'react';

/**
 * Drag to reorder within one level (spec §4.4). Elements of a level carry
 * data-drag-group={group} and data-drag-id={id}; the handle gets the returned onPointerDown.
 * Works with a mouse and with a finger (the handle has touch-action: none). Works in a grid of cards too,
 * because the drop target is whatever element of the same group is under the pointer.
 */
export function useDrag(group: string, onDrop: (id: string, index: number) => void) {
  return useCallback(
    (id: string) => (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      const dragged = handle.closest<HTMLElement>(`[data-drag-id="${id}"]`);
      if (!dragged) return;
      handle.setPointerCapture(e.pointerId);
      const x0 = e.clientX;
      const y0 = e.clientY;
      let target: { el: HTMLElement; after: boolean } | null = null;
      dragged.classList.add('dragging');

      const mark = (t: typeof target) => {
        target?.el.classList.remove('drop-before', 'drop-after');
        target = t;
        target?.el.classList.add(target.after ? 'drop-after' : 'drop-before');
      };

      const move = (ev: globalThis.PointerEvent) => {
        dragged.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px)`;
        const hit = document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .map((el) => (el as HTMLElement).closest<HTMLElement>(`[data-drag-group="${CSS.escape(group)}"]`))
          .find((el) => el && el !== dragged && !dragged.contains(el));
        if (!hit) return;
        const r = hit.getBoundingClientRect();
        mark({ el: hit, after: ev.clientY > r.top + r.height / 2 });
      };

      const end = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        dragged.classList.remove('dragging');
        dragged.style.transform = '';
        const t = target;
        mark(null);
        if (!t) return;
        const others = [...document.querySelectorAll<HTMLElement>(`[data-drag-group="${CSS.escape(group)}"]`)].filter(
          (el) => el !== dragged,
        );
        const at = others.indexOf(t.el);
        if (at >= 0) onDrop(id, at + (t.after ? 1 : 0));
      };

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    },
    [group, onDrop],
  );
}
