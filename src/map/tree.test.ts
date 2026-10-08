import { describe, expect, it } from 'vitest';
import { data, doc, item, project } from '../domain/testkit';
import { addWorkspace, setMember } from '../domain/workspaces';
import { mapTree, type MapNode } from './tree';

const NOW = '2026-10-02T09:00:00+02:00';
const shape = (n: MapNode): unknown => (n.kids.length ? { [n.key]: n.kids.map(shape) } : n.key);

describe('mapTree', () => {
  const d = () =>
    data(
      [
        doc('p', [
          item('a', { order: 'b' }),
          item('b', { order: 'a', due: '2026-10-09' }),
          item('n', { type: 'note', parent: 'a' }),
          item('f', { parent: 'a', folded: true, order: 'b' }),
          item('g', { parent: 'f' }),
          item('h', { parent: 'g' }),
        ]),
        doc(project('q', { folded: true }), [item('x')]),
        doc('r'),
      ],
      { p: 'a', q: 'b', r: 'c' },
    );

  it('Workspace → Projects → Items, in display order; folded branches stop with their hidden count', () => {
    const t = mapTree(d(), null);
    expect(t.label).toBe('All Projects');
    expect(shape(t)).toEqual({ ws: [{ 'project:p': ['item:b', { 'item:a': ['item:n', 'item:f'] }] }, 'project:q', 'project:r'] });
    const f = t.kids[0].kids[1].kids[1];
    expect(f).toMatchObject({ hidden: 2, hasKids: true });
    expect(t.kids[1]).toMatchObject({ hidden: 1, hasKids: true });
    expect(t.kids[2]).toMatchObject({ hidden: 0, hasKids: false });
  });

  it('shows only the current Workspace', () => {
    const w = setMember(addWorkspace(d(), { id: 'w', name: 'Research' }, NOW), 'w', 'r', true, NOW);
    const t = mapTree(w, 'w');
    expect(t.label).toBe('Research');
    expect(t.kids.map((k) => k.key)).toEqual(['project:r']);
  });

  it('leaves out crossed-out Items and Projects (ticket 14); progress still counts them', () => {
    const t = mapTree(
      data(
        [
          doc('p', [item('a'), item('a1', { parent: 'a' }), item('a2', { parent: 'a', crossed: true }), item('done', { crossed: true })]),
          doc(project('gone', { crossed: true })),
          doc(project('f', { folded: true }), [item('x'), item('y', { crossed: true })]),
        ],
        { p: 'a', gone: 'b', f: 'c' },
      ),
      null,
    );
    expect(shape(t)).toEqual({ ws: [{ 'project:p': [{ 'item:a': ['item:a1'] }] }, 'project:f'] });
    expect(t.kids[0].kids[0].progress).toEqual({ done: 1, total: 2 });
    expect(t.kids[1]).toMatchObject({ hidden: 1, hasKids: true });
  });
});
