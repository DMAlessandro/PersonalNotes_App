import { describe, expect, it } from 'vitest';
import {
  canRestore, canUncrossEntry, crossOut, crossProject, deleteItem, deleteProject, restore,
  uncross, uncrossEntry, uncrossProject,
} from './lifecycle';
import { children, sortedProjectIds } from './ordering';
import { data, doc, item, project } from './testkit';
import type { AppData, LogEntry } from './model';

const NOW = '2026-10-02T09:00:00+02:00';
const LATER = '2026-10-03T10:00:00+02:00';
const DEV = 'Phone';
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const entries = (d: AppData): LogEntry[] => Object.values(d.log).sort((a, b) => a.at.localeCompare(b.at));

// t (task, due) ─┬─ a (task)
//                ├─ b (task, already crossed)
//                └─ n (note)
// a ── a1 (task)
const base = () =>
  data([
    doc('p', [
      item('t', { order: 'a', due: '2026-10-05' }),
      item('a', { parent: 't', order: 'a' }),
      item('a1', { parent: 'a', order: 'a' }),
      item('b', { parent: 't', order: 'b', crossed: true, crossedAt: '2026-09-30T08:00:00+02:00' }),
      item('n', { parent: 't', type: 'note', order: 'c' }),
      item('u', { order: 'b' }),
    ]),
  ]);

describe('Cross out (spec §4.2)', () => {
  it('crosses out the whole branch, folds it, and remembers who was already crossed', () => {
    const d = crossOut(base(), 'p', 't', NOW, DEV);
    const it = d.docs.p.items;
    expect(it.t).toMatchObject({ crossed: true, crossedAt: NOW, folded: true, contentAt: NOW });
    for (const id of ['a', 'a1', 'n']) expect(it[id]).toMatchObject({ crossed: true, crossedAt: NOW });
    expect(it.b.crossedAt).toBe('2026-09-30T08:00:00+02:00'); // already crossed: keeps its date
    expect(it.t.crossSnap).toEqual({ a: false, a1: false, b: true, n: false });
  });

  it('keeps the manual order key, so the Item can return to its place (ticket 14)', () => {
    const d = crossOut(base(), 'p', 't', NOW, DEV);
    expect(d.docs.p.items.t.order).toBe('a');
    expect(ids(children(d.docs.p, null))).toEqual(['u', 't']);
  });

  it('adds a "crossed" Change-log entry with the full branch', () => {
    const [e] = entries(crossOut(base(), 'p', 't', NOW, DEV));
    expect(e).toMatchObject({ action: 'crossed', at: NOW, device: DEV, projectId: 'p', itemId: 't', text: 't', count: 5 });
    expect(Object.keys(e.branch).sort()).toEqual(['a', 'a1', 'b', 'n', 't']);
  });

  it('can cross out a child on its own; the parent is untouched', () => {
    const d = crossOut(base(), 'p', 'a', NOW, DEV);
    expect(d.docs.p.items.a1.crossed).toBe(true);
    expect(d.docs.p.items.t.crossed).toBe(false);
  });
});

describe('Un-cross', () => {
  it('puts every child back as it was before, unfolds, and is not logged', () => {
    const crossed = crossOut(base(), 'p', 't', NOW, DEV);
    const d = uncross(crossed, 'p', 't', LATER);
    const it = d.docs.p.items;
    expect(it.t).toMatchObject({ crossed: false, crossedAt: null, crossSnap: null, folded: false });
    expect(it.a).toMatchObject({ crossed: false, crossedAt: null });
    expect(it.a1.crossed).toBe(false);
    expect(it.b).toMatchObject({ crossed: true, crossedAt: '2026-09-30T08:00:00+02:00' });
    expect(Object.keys(d.log)).toHaveLength(1);
  });

  it('crossing out moves the Item below its open siblings; Un-cross puts it back where it was (ticket 14)', () => {
    let d = crossOut(base(), 'p', 't', NOW, DEV);
    expect(ids(children(d.docs.p, null))).toEqual(['u', 't']);
    d = uncross(d, 'p', 't', LATER);
    expect(ids(children(d.docs.p, null))).toEqual(['t', 'u']);
  });

  it('clears a "sent to bottom" left in older data', () => {
    const d0 = crossOut(base(), 'p', 't', NOW, DEV);
    const old = { ...d0, docs: { p: { ...d0.docs.p, items: { ...d0.docs.p.items, t: { ...d0.docs.p.items.t, bottomed: true } } } } };
    expect(uncross(old, 'p', 't', LATER).docs.p.items.t.bottomed).toBe(false);
  });

  it('leaves alone a child added after the cross-out', () => {
    let d = crossOut(base(), 'p', 't', NOW, DEV);
    d = { ...d, docs: { p: { ...d.docs.p, items: { ...d.docs.p.items, z: item('z', { parent: 't', order: 'z' }) } } } };
    expect(uncross(d, 'p', 't', LATER).docs.p.items.z.crossed).toBe(false);
  });
});

describe('Delete (spec §4.3)', () => {
  it('only on a crossed-out Item', () => {
    expect(() => deleteItem(base(), 'p', 'a', NOW, DEV)).toThrow();
  });

  it('removes the branch and logs it with its parent chain and Project', () => {
    let d = crossOut(base(), 'p', 'a', NOW, DEV);
    d = deleteItem(d, 'p', 'a', LATER, DEV);
    expect(d.docs.p.items.a).toBeUndefined();
    expect(d.docs.p.items.a1).toBeUndefined();
    expect(d.docs.p.items.t).toBeDefined();
    const e = entries(d).at(-1)!;
    expect(e).toMatchObject({ action: 'deleted', itemId: 'a', count: 2, projectTitle: 'p' });
    expect(e.ancestors.map((x) => x.id)).toEqual(['t']);
    expect(e.project.id).toBe('p');
  });
});

describe('Restore a Delete = restore the chain (spec §5.5)', () => {
  it('brings the branch back where it was, keeping ids, and adds a "restored" entry', () => {
    let d = deleteItem(crossOut(base(), 'p', 'a', NOW, DEV), 'p', 'a', NOW, DEV);
    const del = entries(d).at(-1)!;
    expect(canRestore(d, del)).toBe(true);
    d = restore(d, del.id, LATER, 'Laptop');
    expect(d.docs.p.items.a).toMatchObject({ parent: 't', crossed: true });
    expect(d.docs.p.items.a1).toBeDefined();
    expect(canRestore(d, del)).toBe(false);
    const r = entries(d).at(-1)!;
    expect(r).toMatchObject({ action: 'restored', restores: del.id, device: 'Laptop', itemId: 'a' });
    expect(d.log[del.id]).toEqual(del); // the old entry stays
  });

  it('also brings back a parent that was deleted later', () => {
    let d = deleteItem(crossOut(base(), 'p', 'a', NOW, DEV), 'p', 'a', NOW, DEV);
    const childDel = entries(d).at(-1)!;
    d = deleteItem(crossOut(d, 'p', 't', NOW, DEV), 'p', 't', NOW, DEV);
    expect(d.docs.p.items.t).toBeUndefined();
    d = restore(d, childDel.id, LATER, DEV);
    expect(d.docs.p.items.t).toBeDefined();
    expect(d.docs.p.items.a.parent).toBe('t');
  });

  it('also brings back a deleted Project, with its order and Workspaces', () => {
    let d = base();
    d = { ...d, index: { ...d.index, workspaces: { w1: { name: 'W', projects: ['p'], at: NOW } } } };
    d = deleteItem(crossOut(d, 'p', 'a', NOW, DEV), 'p', 'a', NOW, DEV);
    const itemDel = entries(d).at(-1)!;
    d = deleteProject(crossProject(d, 'p', NOW, DEV), 'p', NOW, DEV);
    expect(d.docs.p).toBeUndefined();
    expect(d.index.projectOrder.p).toBeUndefined();
    expect(d.index.workspaces.w1.projects).toEqual([]);
    d = restore(d, itemDel.id, LATER, DEV);
    expect(d.docs.p.items.a.parent).toBe('t');
    expect(d.index.projectOrder.p).toBeDefined();
    expect(d.index.workspaces.w1.projects).toEqual(['p']);
  });

  it('restores a whole deleted Project with all its Items', () => {
    let d = deleteProject(crossProject(base(), 'p', NOW, DEV), 'p', NOW, DEV);
    const del = entries(d).at(-1)!;
    expect(del).toMatchObject({ action: 'deleted', itemId: null, count: 6 });
    d = restore(d, del.id, LATER, DEV);
    expect(Object.keys(d.docs.p.items).sort()).toEqual(['a', 'a1', 'b', 'n', 't', 'u']);
    expect(sortedProjectIds(d)).toEqual(['p']);
  });

  it('refuses to restore twice, or to restore a Cross-out entry', () => {
    const crossed = crossOut(base(), 'p', 'a', NOW, DEV);
    expect(canRestore(crossed, entries(crossed)[0])).toBe(false);
  });
});

describe('Un-cross from the log', () => {
  it('is offered while the Item is still crossed out', () => {
    let d = crossOut(base(), 'p', 'a', NOW, DEV);
    const e = entries(d)[0];
    expect(canUncrossEntry(d, e)).toBe(true);
    d = uncrossEntry(d, e.id, LATER);
    expect(d.docs.p.items.a.crossed).toBe(false);
    expect(canUncrossEntry(d, e)).toBe(false);
  });

  it('works for a Project entry too', () => {
    let d = crossProject(base(), 'p', NOW, DEV);
    const e = entries(d)[0];
    expect(canUncrossEntry(d, e)).toBe(true);
    d = uncrossEntry(d, e.id, LATER);
    expect(d.docs.p.project.crossed).toBe(false);
  });
});

describe('Projects cross out like Items (spec §4.2, open point 8)', () => {
  it('crosses out every Item, greys and folds the Project, logs it; Un-cross puts them back', () => {
    let d = crossProject(base(), 'p', NOW, DEV);
    expect(d.docs.p.project).toMatchObject({ crossed: true, crossedAt: NOW, folded: true });
    expect(Object.values(d.docs.p.items).every((i) => i.crossed)).toBe(true);
    expect(entries(d)[0]).toMatchObject({ action: 'crossed', itemId: null, count: 6 });
    d = uncrossProject(d, 'p', LATER);
    expect(d.docs.p.project).toMatchObject({ crossed: false, bottomed: false, folded: false });
    expect(d.docs.p.items.b.crossed).toBe(true);
    expect(d.docs.p.items.a.crossed).toBe(false);
  });

  it('a crossed-out Project goes after the open ones; Un-cross puts it back (ticket 14)', () => {
    const two = data([doc(project('p1')), doc(project('p2'))], { p1: 'a', p2: 'b' });
    let d = crossProject(two, 'p1', NOW, DEV);
    expect(sortedProjectIds(d)).toEqual(['p2', 'p1']);
    d = uncrossProject(d, 'p1', LATER);
    expect(sortedProjectIds(d)).toEqual(['p1', 'p2']);
  });

  it('Delete is only for a crossed-out Project', () => {
    expect(() => deleteProject(base(), 'p', NOW, DEV)).toThrow();
  });
});
