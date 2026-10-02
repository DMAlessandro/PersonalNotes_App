// Spec §5.3: automatic placement, ported from prototypes/map-touch-prototype.html (layout A and B).
// Box sizes come from measuring the text in the DOM; this part is pure, so it is tested with given sizes.

export type Shape = { key: string; kids: Shape[] };
export type Size = { w: number; h: number };
/** Top-left corner and size. */
export type Box = { key: string; x: number; y: number; w: number; h: number; depth: number };
export type Edge = { from: string; to: string };
export type Direction = 'lr' | 'td';

const LR_COL_GAP = 60;
const LR_ROW_GAP = 12;
const TD_ROW_GAP = 70;
const TD_COL_GAP = 16;

type T = { key: string; depth: number; w: number; h: number; kids: T[]; c: number };

/**
 * Left → right: one column per depth, as wide as its widest box; each subtree gets a band tall enough for
 * it, and a parent sits centred on its children (or pushes them down if it is taller than they are).
 * Top-down is the same, turned 90°.
 */
export function layout(root: Shape, size: (key: string) => Size, dir: Direction): { boxes: Box[]; edges: Edge[]; width: number; height: number } {
  const all: T[] = [];
  const edges: Edge[] = [];
  const build = (s: Shape, depth: number): T => {
    const t: T = { key: s.key, depth, ...size(s.key), kids: [], c: 0 };
    all.push(t);
    for (const k of s.kids) {
      edges.push({ from: s.key, to: k.key });
      t.kids.push(build(k, depth + 1));
    }
    return t;
  };
  const top = build(root, 0);

  const lr = dir === 'lr';
  // Across = the axis of depth (x for lr); along = the axis siblings spread on (y for lr).
  const across = (t: T) => (lr ? t.w : t.h);
  const along = (t: T) => (lr ? t.h : t.w);
  const levelGap = lr ? LR_COL_GAP : TD_ROW_GAP;
  const sibGap = lr ? LR_ROW_GAP : TD_COL_GAP;

  const level: number[] = [];
  for (const t of all) level[t.depth] = Math.max(level[t.depth] ?? 0, across(t));
  const levelStart = level.map((_, d) => level.slice(0, d).reduce((a, w) => a + w + levelGap, 0));

  // `c` is the centre of each box along the sibling axis.
  let cursor = 0;
  const shift = (t: T, d: number) => {
    t.c += d;
    t.kids.forEach((k) => shift(k, d));
  };
  const place = (t: T) => {
    const bandStart = cursor;
    if (!t.kids.length) {
      t.c = cursor + along(t) / 2;
      cursor += along(t) + sibGap;
      return;
    }
    t.kids.forEach(place);
    t.c = (t.kids[0].c + t.kids[t.kids.length - 1].c) / 2;
    if (t.c - along(t) / 2 < bandStart) {
      const d = bandStart - (t.c - along(t) / 2);
      shift(t, d);
      cursor += d;
    }
    cursor = Math.max(cursor, t.c + along(t) / 2 + sibGap);
  };
  place(top);

  const boxes = all.map((t): Box => {
    const a = levelStart[t.depth];
    const s = t.c - along(t) / 2;
    return lr ? { key: t.key, x: a, y: s, w: t.w, h: t.h, depth: t.depth } : { key: t.key, x: s, y: a, w: t.w, h: t.h, depth: t.depth };
  });
  return {
    boxes,
    edges,
    width: Math.max(0, ...boxes.map((b) => b.x + b.w)),
    height: Math.max(0, ...boxes.map((b) => b.y + b.h)),
  };
}

/** Curved connector from the parent's side to the child's, as in the prototype. */
export function edgePath(p: Box, c: Box, dir: Direction): string {
  if (dir === 'lr') {
    const x1 = p.x + p.w, y1 = p.y + p.h / 2, x2 = c.x, y2 = c.y + c.h / 2;
    return `M${x1},${y1} C${x1 + 35},${y1} ${x2 - 35},${y2} ${x2},${y2}`;
  }
  const x1 = p.x + p.w / 2, y1 = p.y + p.h, x2 = c.x + c.w / 2, y2 = c.y;
  return `M${x1},${y1} C${x1},${y1 + 35} ${x2},${y2 - 35} ${x2},${y2}`;
}

export type View = { tx: number; ty: number; s: number };

/** Never open below ~12px text (spec §5.3). */
export const MIN_OPEN_SCALE = 0.85;

/**
 * Opening zoom: fit if everything fits at MIN_OPEN_SCALE or more (centred, at most 1.2);
 * otherwise MIN_OPEN_SCALE from the top-left, and the user pans.
 */
export function openingView(content: Size, viewport: Size, pad = 30): View {
  if (!content.w || !content.h) return { tx: pad / 2, ty: pad / 2, s: 1 };
  const fit = Math.min(1.2, (viewport.w - pad) / content.w, (viewport.h - pad) / content.h);
  if (fit >= MIN_OPEN_SCALE) {
    return { s: fit, tx: (viewport.w - content.w * fit) / 2, ty: (viewport.h - content.h * fit) / 2 };
  }
  return { s: MIN_OPEN_SCALE, tx: pad / 2, ty: pad / 2 };
}

/** Zoom by `k` around a viewport point, keeping that point still. Manual zoom may go further out (0.15). */
export function zoomAt(v: View, k: number, cx: number, cy: number): View {
  const s = Math.min(2.5, Math.max(0.15, v.s * k));
  const r = s / v.s;
  return { s, tx: cx - (cx - v.tx) * r, ty: cy - (cy - v.ty) * r };
}
