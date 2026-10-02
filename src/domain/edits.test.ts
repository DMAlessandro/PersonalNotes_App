import { describe, expect, it } from 'vitest';
import {
  addItem, addProject, canIndent, canOutdent, discardItem, editText, indent, makeTask, moveItem, moveProject,
  outdent, renameProject, setDue, setFolded,
} from './edits';
import { children, sortedProjectIds } from './ordering';
import { problems } from './structure';
import { data, doc, item } from './testkit';
import { emptyData } from './model';

const NOW = '2026-10-02T09:00:00+02:00';
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('Projects', () => {
  it('adds a Project at the end of the manual order', () => {
    let d = addProject(emptyData(), { id: 'p1', title: 'One' }, NOW);
    d = addProject(d, { id: 'p2', title: 'Two' }, NOW);
    expect(sortedProjectIds(d)).toEqual(['p1', 'p2']);
    expect(d.docs.p2.project).toMatchObject({ title: 'Two', created: NOW, crossed: false });
  });

  it('renames, stamping the content time', () => {
    const d = renameProject(addProject(emptyData(), { id: 'p', title: 'Old' }, 'x'), 'p', 'New', NOW);
    expect(d.docs.p.project).toMatchObject({ title: 'New', edited: NOW, contentAt: NOW });
  });

  it('drags a Project to a new place in the manual order', () => {
    const d = data([doc('a'), doc('b'), doc('c')], { a: 'a', b: 'b', c: 'c' });
    expect(sortedProjectIds(moveProject(d, 'c', 0, NOW))).toEqual(['c', 'a', 'b']);
    expect(sortedProjectIds(moveProject(d, 'a', 1, NOW))).toEqual(['b', 'a', 'c']);
    expect(moveProject(d, 'c', 0, NOW).index.projectOrder.c.at).toBe(NOW);
  });
});

describe('adding Items', () => {
  const base = data([doc('p', [item('t', { order: 'a' }), item('n0', { type: 'note', parent: 't', order: 'a' })])]);

  it('adds a top-level Task at the end', () => {
    const d = addItem(base, 'p', { id: 'x', type: 'task', text: 'New', parent: null }, NOW);
    expect(ids(children(d.docs.p, null))).toEqual(['t', 'x']);
    expect(d.docs.p.items.x).toMatchObject({ text: 'New', created: NOW, contentAt: NOW, positionAt: NOW });
  });

  it('adds a Note under a Task, at the end of its children', () => {
    const d = addItem(base, 'p', { id: 'n1', type: 'note', text: '', parent: 't' }, NOW);
    expect(ids(children(d.docs.p, 't'))).toEqual(['n0', 'n1']);
  });

  it('refuses a top-level Note, a child of a Note, and a due date on a Note', () => {
    expect(() => addItem(base, 'p', { id: 'x', type: 'note', text: '', parent: null }, NOW)).toThrow();
    expect(() => addItem(base, 'p', { id: 'x', type: 'task', text: '', parent: 'n0' }, NOW)).toThrow();
    expect(() => addItem(base, 'p', { id: 'x', type: 'note', text: '', parent: 't', due: '2026-10-09' }, NOW)).toThrow();
  });

  it('discards a new empty Item (not a Delete, nothing is logged)', () => {
    const d = addItem(base, 'p', { id: 'x', type: 'task', text: '', parent: 't' }, NOW);
    expect(discardItem(d, 'p', 'x').docs.p.items.x).toBeUndefined();
  });
});

describe('changing Items', () => {
  const base = data([doc('p', [item('t'), item('n', { type: 'note', parent: 't' })])]);

  it('edits text, stamping edited and content time but not position time', () => {
    const changed = editText(base, 'p', 't', 'Hello', NOW).docs.p.items.t;
    expect(changed).toMatchObject({ text: 'Hello', edited: NOW, contentAt: NOW });
    expect(changed.positionAt).not.toBe(NOW);
  });

  it('sets and clears a due date on Tasks only', () => {
    expect(setDue(base, 'p', 't', '2026-10-09', NOW).docs.p.items.t.due).toBe('2026-10-09');
    expect(setDue(setDue(base, 'p', 't', '2026-10-09', NOW), 'p', 't', null, NOW).docs.p.items.t.due).toBeNull();
    expect(() => setDue(base, 'p', 'n', '2026-10-09', NOW)).toThrow();
  });

  it('turns a Note into a Task, never back', () => {
    expect(makeTask(base, 'p', 'n', NOW).docs.p.items.n.type).toBe('task');
    expect(() => makeTask(base, 'p', 't', NOW)).toThrow();
  });

  it('folds and unfolds, stamping position time', () => {
    expect(setFolded(base, 'p', 't', true, NOW).docs.p.items.t).toMatchObject({ folded: true, positionAt: NOW });
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(base);
    editText(base, 'p', 't', 'x', NOW);
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe('reordering by drag', () => {
  // display order: d1 (dated), a, b, c
  const base = data([
    doc('p', [
      item('d1', { due: '2026-10-05', order: 'm' }),
      item('a', { order: 'b' }),
      item('b', { order: 'd' }),
      item('c', { order: 'f' }),
    ]),
  ]);
  const after = (id: string, index: number) => ids(children(moveItem(base, 'p', id, index, NOW).docs.p, null));

  it('moves an Item to a new place among its undated siblings', () => {
    expect(after('c', 1)).toEqual(['d1', 'c', 'a', 'b']);
    expect(after('a', 3)).toEqual(['d1', 'b', 'c', 'a']);
    expect(after('b', 1)).toEqual(['d1', 'b', 'a', 'c']);
  });

  it('dropping above the dated group puts it first of the undated ones', () => {
    expect(after('c', 0)).toEqual(['d1', 'c', 'a', 'b']);
  });

  it('a dated Item keeps showing in date order', () => {
    expect(after('d1', 3)).toEqual(['d1', 'a', 'b', 'c']);
  });

  it('stamps position time on the moved Item only', () => {
    const d = moveItem(base, 'p', 'c', 1, NOW).docs.p.items;
    expect(d.c.positionAt).toBe(NOW);
    expect(d.a.positionAt).not.toBe(NOW);
  });
});

describe('indent and outdent', () => {
  const base = data([
    doc('p', [
      item('t1', { order: 'a' }),
      item('t2', { order: 'b' }),
      item('k1', { parent: 't1', order: 'a' }),
      item('n', { type: 'note', parent: 't1', order: 'b' }),
      item('k2', { parent: 't1', order: 'c' }),
      item('kk', { parent: 'k1', order: 'a' }),
    ]),
  ]);

  it('indent makes an Item the last child of the Task just above it', () => {
    const d = indent(base, 'p', 't2', NOW);
    expect(d.docs.p.items.t2).toMatchObject({ parent: 't1', positionAt: NOW });
    expect(ids(children(d.docs.p, 't1'))).toEqual(['k1', 'n', 'k2', 't2']);
  });

  it('cannot indent the first Item of a level or under a Note', () => {
    expect(canIndent(base.docs.p, 't1')).toBe(false);
    expect(canIndent(base.docs.p, 'k1')).toBe(false);
    expect(canIndent(base.docs.p, 'k2')).toBe(false); // the Item above is a Note
    expect(() => indent(base, 'p', 'k2', NOW)).toThrow();
  });

  it('outdent puts an Item right after its old parent', () => {
    const d = outdent(base, 'p', 'k1', NOW);
    expect(ids(children(d.docs.p, null))).toEqual(['t1', 'k1', 't2']);
    expect(ids(children(d.docs.p, 'k1'))).toEqual(['kk']);
  });

  it('cannot outdent a top-level Item or a Note to the top level', () => {
    expect(canOutdent(base.docs.p, 't1')).toBe(false);
    expect(canOutdent(base.docs.p, 'n')).toBe(false);
    expect(canOutdent(base.docs.p, 'kk')).toBe(true);
  });

  it('every edit leaves a valid structure', () => {
    for (const d of [indent(base, 'p', 't2', NOW), outdent(base, 'p', 'k1', NOW), outdent(base, 'p', 'kk', NOW)]) {
      expect(problems(d.docs.p)).toEqual([]);
    }
  });
});

describe('structure rules (spec §2.1)', () => {
  it('reports top-level Notes, Notes with children, Notes with dates, missing parents and cycles', () => {
    const bad = doc('p', [
      item('n1', { type: 'note' }),
      item('t', {}),
      item('n2', { type: 'note', parent: 't', due: '2026-10-01' }),
      item('c', { parent: 'n2' }),
      item('lost', { parent: 'nope' }),
      item('x', { parent: 'y' }),
      item('y', { parent: 'x' }),
    ]);
    expect([...new Set(problems(bad).map((p) => p.id))].sort()).toEqual(['c', 'lost', 'n1', 'n2', 'x', 'y']);
  });
});
