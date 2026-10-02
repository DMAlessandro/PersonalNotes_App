import { describe, expect, it } from 'vitest';
import { merge, resolveClash } from './merge';
import { data, doc, item, project } from './testkit';
import { problems } from './structure';
import type { AppData, Item } from './model';

const T0 = '2026-10-01T10:00:00.000+02:00';
const T1 = '2026-10-02T09:00:00.000+02:00';
const T2 = '2026-10-02T10:00:00.000+02:00';
const NOW = '2026-10-02T11:00:00.000+02:00';

/** Base: Project p with Tasks a, b (b has child b1) and Note n under a; Project q with Task x. */
const base = (): AppData =>
  data(
    [
      doc(project('p', { title: 'Grant' }), [
        item('a', { order: 'a' }),
        item('n', { type: 'note', parent: 'a', order: 'a' }),
        item('b', { order: 'b' }),
        item('b1', { parent: 'b', order: 'a' }),
      ]),
      doc(project('q', { title: 'Teaching' }), [item('x', { order: 'a' })]),
    ],
    { p: 'a', q: 'b' },
  );

/** Change one Item's fields (stamping times like the real edits do). */
function set(d: AppData, pid: string, id: string, fields: Partial<Item>, at = T1, kind: 'content' | 'position' = 'content'): AppData {
  const it = d.docs[pid].items[id];
  const stamp = kind === 'content' ? { contentAt: at, edited: at } : { positionAt: at };
  return { ...d, docs: { ...d.docs, [pid]: { ...d.docs[pid], items: { ...d.docs[pid].items, [id]: { ...it, ...fields, ...stamp } } } } };
}
function remove(d: AppData, pid: string, ...ids: string[]): AppData {
  const items = { ...d.docs[pid].items };
  for (const id of ids) delete items[id];
  return { ...d, docs: { ...d.docs, [pid]: { ...d.docs[pid], items } } };
}
function add(d: AppData, pid: string, it: Item): AppData {
  return { ...d, docs: { ...d.docs, [pid]: { ...d.docs[pid], items: { ...d.docs[pid].items, [it.id]: it } } } };
}
const items = (d: AppData, pid: string) => d.docs[pid]?.items ?? {};

describe('three-way merge: whole records (spec §6.2 table)', () => {
  it('keeps Items added on either side', () => {
    const l = add(base(), 'p', item('new-l', { order: 'c', created: T1 }));
    const r = add(base(), 'q', item('new-r', { order: 'c', created: T1 }));
    const { result, clashes } = merge(base(), l, r);
    expect(items(result, 'p')['new-l']).toBeDefined();
    expect(items(result, 'q')['new-r']).toBeDefined();
    expect(clashes).toEqual([]);
  });

  it('drops an Item deleted on one side and untouched on the other', () => {
    const { result } = merge(base(), remove(base(), 'p', 'b', 'b1'), base());
    expect(items(result, 'p').b).toBeUndefined();
    expect(items(result, 'p').b1).toBeUndefined();
  });

  it('an edit beats a Delete: the Item comes back with the edit', () => {
    const l = remove(base(), 'p', 'b', 'b1');
    const r = set(base(), 'p', 'b1', { text: 'edited on phone' });
    const { result, clashes } = merge(base(), l, r);
    expect(items(result, 'p').b1.text).toBe('edited on phone');
    expect(items(result, 'p').b).toBeDefined(); // its parent comes back too (repair 1)
    expect(clashes).toEqual([]);
  });

  it('a move does not save an Item from a Delete (open point 12)', () => {
    const l = remove(base(), 'p', 'b', 'b1');
    const r = set(base(), 'p', 'b', { order: 'z' }, T1, 'position');
    expect(items(merge(base(), l, r).result, 'p').b).toBeUndefined();
  });

  it('deleted on both sides: gone', () => {
    const gone = remove(base(), 'p', 'b', 'b1');
    expect(items(merge(base(), gone, gone).result, 'p').b).toBeUndefined();
  });
});

describe('three-way merge: field by field', () => {
  it('different Items of the same Project merge silently', () => {
    const l = set(base(), 'p', 'a', { text: 'laptop' });
    const r = set(base(), 'p', 'b', { text: 'phone' });
    const { result, clashes } = merge(base(), l, r);
    expect(items(result, 'p').a.text).toBe('laptop');
    expect(items(result, 'p').b.text).toBe('phone');
    expect(clashes).toEqual([]);
  });

  it('same change on both sides is not a clash', () => {
    const l = set(base(), 'p', 'a', { text: 'same' });
    const r = set(base(), 'p', 'a', { text: 'same' }, T2);
    expect(merge(base(), l, r).clashes).toEqual([]);
  });

  it('a text edit on one side and a Cross-out on the other both apply (open point 1)', () => {
    const l = set(base(), 'p', 'a', { text: 'new text' });
    const r = set(base(), 'p', 'a', { crossed: true, crossedAt: T2 }, T2);
    const { result, clashes } = merge(base(), l, r);
    expect(items(result, 'p').a).toMatchObject({ text: 'new text', crossed: true, crossedAt: T2 });
    expect(clashes).toEqual([]);
  });

  it('the same Item\'s text changed differently on both sides is a Clash; this device\'s text is kept until settled', () => {
    const l = set(base(), 'p', 'a', { text: 'laptop' });
    const r = set(base(), 'p', 'a', { text: 'phone', due: '2026-10-09' }, T2);
    const { result, clashes } = merge(base(), l, r);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ kind: 'item', id: 'a', pid: 'p', fields: ['text'] });
    expect(items(result, 'p').a).toMatchObject({ text: 'laptop', due: '2026-10-09' }); // due changed only on the phone
  });

  it('a due date changed differently on both sides is a Clash', () => {
    const l = set(base(), 'p', 'a', { due: '2026-10-05' });
    const r = set(base(), 'p', 'a', { due: '2026-10-06' }, T2);
    expect(merge(base(), l, r).clashes[0].fields).toEqual(['due']);
  });

  it('Note → Task on either side makes it a Task', () => {
    const r = set(base(), 'p', 'n', { type: 'task' });
    expect(items(merge(base(), base(), r).result, 'p').n.type).toBe('task');
  });

  it('position-only clashes merge silently: the later change wins', () => {
    const l = set(base(), 'p', 'a', { order: 'x' }, T2, 'position');
    const r = set(base(), 'p', 'a', { order: 'y' }, T1, 'position');
    const { result, clashes } = merge(base(), l, r);
    expect(items(result, 'p').a.order).toBe('x');
    expect(clashes).toEqual([]);
    const l2 = set(base(), 'p', 'a', { folded: true }, T1, 'position');
    const r2 = set(base(), 'p', 'a', { folded: false, bottomed: true }, T2, 'position');
    expect(items(merge(base(), l2, r2).result, 'p').a).toMatchObject({ folded: true, bottomed: true });
  });

  it('a move to another Project on one side and an edit on the other: both apply', () => {
    const moved = (() => {
      const d = remove(base(), 'p', 'b', 'b1');
      const b = { ...base().docs.p.items.b, order: 'z', positionAt: T1 };
      const b1 = base().docs.p.items.b1;
      return add(add(d, 'q', b), 'q', b1);
    })();
    const r = set(base(), 'p', 'b1', { text: 'edited' }, T2);
    const { result, clashes } = merge(base(), moved, r);
    expect(items(result, 'p').b).toBeUndefined();
    expect(items(result, 'q').b).toBeDefined();
    expect(items(result, 'q').b1.text).toBe('edited');
    expect(clashes).toEqual([]);
  });
});

describe('Projects, index and Change log', () => {
  it('the same Project renamed differently on both sides is a Clash', () => {
    const rename = (d: AppData, title: string, at: string) => ({
      ...d,
      docs: { ...d.docs, p: { ...d.docs.p, project: { ...d.docs.p.project, title, contentAt: at } } },
    });
    const { clashes, result } = merge(base(), rename(base(), 'Grant A', T1), rename(base(), 'Grant B', T2));
    expect(clashes[0]).toMatchObject({ kind: 'project', id: 'p', fields: ['title'] });
    expect(result.docs.p.project.title).toBe('Grant A');
  });

  it('a Project deleted on one side comes back if the other side edited one of its Items', () => {
    const l = (() => {
      const d = base();
      const { p: _p, ...docs } = d.docs;
      const { p: _o, ...projectOrder } = d.index.projectOrder;
      return { ...d, docs, index: { ...d.index, projectOrder } };
    })();
    const r = set(base(), 'p', 'a', { text: 'still working on it' });
    const { result } = merge(base(), l, r);
    expect(result.docs.p.items.a.text).toBe('still working on it');
    expect(result.index.projectOrder.p).toBeDefined();
    expect(result.docs.p.items.b).toBeUndefined(); // untouched Items stay deleted
  });

  it('Project order: the later change wins; Workspaces merge membership as sets', () => {
    const l = { ...base(), index: { ...base().index, projectOrder: { ...base().index.projectOrder, q: { order: '0', at: T2 } }, workspaces: { w: { name: 'Research', projects: ['p', 'q'], at: T1 } } } };
    const b = { ...base(), index: { ...base().index, workspaces: { w: { name: 'Research', projects: ['p'], at: T0 } } } };
    const lb = { ...l };
    const r = { ...base(), index: { ...base().index, projectOrder: { ...base().index.projectOrder, q: { order: 'z', at: T1 } }, workspaces: { w: { name: 'Work', projects: [], at: T1 } } } };
    const { result } = merge(b, lb, r);
    expect(result.index.projectOrder.q.order).toBe('0');
    expect(result.index.workspaces.w.projects).toEqual(['q']); // p removed on the phone, q added on the laptop
    expect(result.index.workspaces.w.name).toBe('Work');
  });

  it('Change-log entries from both sides are kept (union), never a clash', () => {
    const entry = (id: string) => ({ id, action: 'crossed', at: T1 }) as AppData['log'][string];
    const l = { ...base(), log: { c1: entry('c1') } };
    const r = { ...base(), log: { c2: entry('c2') } };
    expect(Object.keys(merge(base(), l, r).result.log).sort()).toEqual(['c1', 'c2']);
  });
});

describe('structure repair after merging (spec §6.2)', () => {
  it('undoes the earlier of two moves that would make a cycle', () => {
    const l = set(base(), 'p', 'a', { parent: 'b', order: 'z' }, T1, 'position'); // a under b
    const r = set(base(), 'p', 'b', { parent: 'a', order: 'z' }, T2, 'position'); // b under a (later)
    const { result } = merge(base(), l, r);
    expect(problems(result.docs.p)).toEqual([]);
    expect(result.docs.p.items.b.parent).toBe('a');
    expect(result.docs.p.items.a.parent).toBeNull();
  });

  it('a Note left without a Task parent becomes a Task', () => {
    // Phone outdents the Note's parent... simplest case: the Note's parent Task is deleted on one side
    // while the Note is moved to top level is impossible in the app, so simulate a top-level Note.
    const r = set(base(), 'p', 'n', { parent: null }, T1, 'position');
    const { result } = merge(base(), base(), r);
    expect(result.docs.p.items.n.type).toBe('task');
    expect(problems(result.docs.p)).toEqual([]);
  });

  it('gives a fresh order key when two siblings end up with the same one', () => {
    const l = add(base(), 'p', item('l1', { order: 'c' }));
    const r = add(base(), 'p', item('r1', { order: 'c', positionAt: T2 }));
    const { result } = merge(base(), l, r);
    expect(result.docs.p.items.l1.order).not.toBe(result.docs.p.items.r1.order);
  });

  it('a child added under a Task that was crossed out on the other side stays open (open point 13)', () => {
    const l = add(base(), 'p', item('kid', { parent: 'b', order: 'z' }));
    const r = set(base(), 'p', 'b', { crossed: true, crossedAt: T1 });
    const { result } = merge(base(), l, r);
    expect(result.docs.p.items.b.crossed).toBe(true);
    expect(result.docs.p.items.kid.crossed).toBe(false);
  });
});

describe('settling a Clash (spec §5.6)', () => {
  const clashed = () => {
    const l = set(base(), 'p', 'a', { text: 'laptop' });
    const r = set(base(), 'p', 'a', { text: 'phone' }, T2);
    return merge(base(), l, r);
  };

  it('Keep this device\'s: unchanged', () => {
    const { result, clashes } = clashed();
    expect(resolveClash(result, clashes[0], 'this', NOW).docs.p.items.a.text).toBe('laptop');
  });

  it('Keep the other\'s: takes the other device\'s values for the clashing fields', () => {
    const { result, clashes } = clashed();
    expect(resolveClash(result, clashes[0], 'other', NOW).docs.p.items.a.text).toBe('phone');
  });

  it('Keep both: the other version is added as a sibling right after; children stay with the original', () => {
    const { result, clashes } = clashed();
    const d = resolveClash(result, clashes[0], 'both', NOW);
    const copies = Object.values(d.docs.p.items).filter((i) => i.text === 'phone');
    expect(copies).toHaveLength(1);
    const copy = copies[0];
    expect(copy.id).not.toBe('a');
    expect(copy.parent).toBe(null);
    expect(copy.order > d.docs.p.items.a.order && copy.order < d.docs.p.items.b.order).toBe(true);
    expect(d.docs.p.items.n.parent).toBe('a');
  });
});
