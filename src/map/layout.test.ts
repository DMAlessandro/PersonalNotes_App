import { describe, expect, it } from 'vitest';
import { layout, MIN_OPEN_SCALE, openingView, zoomAt, type Box, type Shape } from './layout';

/** Tiny tree builder: key + kids. */
const n = (key: string, ...kids: Shape[]): Shape => ({ key, kids });
const sizes: Record<string, { w: number; h: number }> = {
  ws: { w: 100, h: 40 },
  p: { w: 150, h: 46 },
  a: { w: 120, h: 46 },
  b: { w: 200, h: 90 },
  a1: { w: 96, h: 36 },
  a2: { w: 130, h: 36 },
};
const size = (k: string) => sizes[k] ?? { w: 100, h: 40 };
const tree = n('ws', n('p', n('a', n('a1'), n('a2')), n('b')));

function overlaps(boxes: Box[]): string[] {
  const out: string[] = [];
  for (const a of boxes)
    for (const b of boxes)
      if (a.key < b.key && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(`${a.key}/${b.key}`);
  return out;
}
const byKey = (bs: Box[]) => Object.fromEntries(bs.map((b) => [b.key, b]));

describe('left → right layout', () => {
  const { boxes, edges, width, height } = layout(tree, size, 'lr');
  const b = byKey(boxes);

  it('puts each depth in a column as wide as its widest box', () => {
    expect(b.ws.x).toBe(0);
    expect(b.p.x).toBe(100 + 60);
    expect(b.a.x).toBe(b.b.x); // same column
    expect(b.a1.x).toBe(b.p.x + 150 + 60 + 200 + 60); // column 2 is as wide as b (200)
    expect(b.a1.x).toBe(b.a2.x);
  });

  it('never overlaps, keeps sibling order top to bottom, centres a parent on its children', () => {
    expect(overlaps(boxes)).toEqual([]);
    expect(b.a1.y).toBeLessThan(b.a2.y);
    expect(b.a.y).toBeLessThan(b.b.y);
    const mid = (k: string) => b[k].y + b[k].h / 2;
    expect(mid('a')).toBeCloseTo((mid('a1') + mid('a2')) / 2);
  });

  it('gives a connector per child and a total size', () => {
    expect(edges.map((e) => `${e.from}>${e.to}`)).toEqual(['ws>p', 'p>a', 'a>a1', 'a>a2', 'p>b']);
    expect(width).toBe(Math.max(...boxes.map((x) => x.x + x.w)));
    expect(height).toBe(Math.max(...boxes.map((x) => x.y + x.h)));
  });

  it('a parent taller than its children pushes them down instead of overlapping', () => {
    const tall = layout(n('ws', n('big', n('s1')), n('next')), (k) => (k === 'big' ? { w: 100, h: 200 } : { w: 100, h: 30 }), 'lr');
    expect(overlaps(tall.boxes)).toEqual([]);
    expect(Math.min(...tall.boxes.map((x) => x.y))).toBe(0);
  });
});

describe('top-down layout', () => {
  const { boxes } = layout(tree, size, 'td');
  const b = byKey(boxes);
  it('puts each depth in a row and never overlaps', () => {
    expect(b.ws.y).toBe(0);
    expect(b.a.y).toBe(b.b.y);
    expect(b.a1.y).toBe(b.a2.y);
    expect(b.a1.x).toBeLessThan(b.a2.x);
    expect(overlaps(boxes)).toEqual([]);
  });
});

describe('opening zoom', () => {
  it('centres the map when it fits at 0.85 or more, never above 1.2', () => {
    const v = openingView({ w: 400, h: 200 }, { w: 1000, h: 600 });
    expect(v.s).toBe(1.2);
    expect(v.tx).toBeCloseTo((1000 - 480) / 2);
    expect(v.ty).toBeCloseTo((600 - 240) / 2);
  });
  it('opens at 0.85 from the top-left when it does not fit', () => {
    expect(openingView({ w: 3000, h: 2000 }, { w: 1000, h: 600 })).toEqual({ s: MIN_OPEN_SCALE, tx: 15, ty: 15 });
  });
  it('zooms around a point, keeping it still', () => {
    const v = zoomAt({ tx: 0, ty: 0, s: 1 }, 2, 100, 50);
    expect(v).toEqual({ s: 2, tx: -100, ty: -50 });
    expect(zoomAt({ tx: 0, ty: 0, s: 0.2 }, 0.1, 0, 0).s).toBe(0.15);
  });
});
