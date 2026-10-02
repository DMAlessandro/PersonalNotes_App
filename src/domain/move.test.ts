import { describe, expect, it } from 'vitest';
import { canMoveToProject, moveToProject, reveal } from './edits';
import { children } from './ordering';
import { problems } from './structure';
import { data, doc, item } from './testkit';

const NOW = '2026-10-02T09:00:00+02:00';

describe('Move to Project', () => {
  const base = () =>
    data([
      doc('p', [
        item('t', { order: 'a' }),
        item('s', { parent: 't', order: 'a', crossed: true }),
        item('n', { type: 'note', parent: 's', order: 'a' }),
        item('k', { parent: 't', order: 'b' }),
      ]),
      doc('q', [item('x', { order: 'a' })]),
    ]);

  it('moves a Task and its branch to the end of the other Project\'s top level', () => {
    const d = moveToProject(base(), 'p', 's', 'q', NOW);
    expect(Object.keys(d.docs.p.items).sort()).toEqual(['k', 't']);
    expect(children(d.docs.q, null).map((i) => i.id)).toEqual(['x', 's']);
    expect(d.docs.q.items.s).toMatchObject({ parent: null, crossed: true, positionAt: NOW });
    expect(d.docs.q.items.n).toMatchObject({ parent: 's', positionAt: NOW });
    expect(problems(d.docs.p)).toEqual([]);
    expect(problems(d.docs.q)).toEqual([]);
  });

  it('is offered on Tasks only, and only to another Project', () => {
    expect(canMoveToProject(base().docs.p, 's')).toBe(true);
    expect(canMoveToProject(base().docs.p, 'n')).toBe(false);
    expect(() => moveToProject(base(), 'p', 'n', 'q', NOW)).toThrow();
    expect(() => moveToProject(base(), 'p', 't', 'p', NOW)).toThrow();
  });
});

describe('reveal (search jump)', () => {
  it('unfolds every folded parent of the Item, not the Item itself', () => {
    const d = data([
      doc('p', [
        item('a', { folded: true }),
        item('b', { parent: 'a', folded: true }),
        item('c', { parent: 'b', folded: true }),
        item('d', { parent: 'c' }),
        item('z', { folded: true }),
      ]),
    ]);
    const r = reveal(d, 'p', 'c', NOW);
    expect(r.docs.p.items.a).toMatchObject({ folded: false, positionAt: NOW });
    expect(r.docs.p.items.b.folded).toBe(false);
    expect(r.docs.p.items.c.folded).toBe(true);
    expect(r.docs.p.items.z.folded).toBe(true);
    expect(reveal(r, 'p', 'c', NOW)).toBe(r); // nothing to unfold: unchanged
  });
});
