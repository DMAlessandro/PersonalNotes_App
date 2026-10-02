// Spec §4.4: the edits a user makes, as pure functions AppData → AppData.
// Each one stamps `contentAt` (text, type, due, crossed) or `positionAt` (parent, order, bottomed, folded)
// so the three-way merge can tell which side changed what. Invalid edits throw; the UI asks can*() first.
import type { AppData, DateOnly, Item, ItemType, ProjectDoc, Timestamp } from './model';
import { keyBetween } from './orderKey';
import { children, projectSortDate, sortedProjectIds } from './ordering';

// ---- helpers ---------------------------------------------------------------

function withDoc(data: AppData, pid: string, fn: (doc: ProjectDoc) => ProjectDoc): AppData {
  const doc = data.docs[pid];
  if (!doc) throw new Error(`No Project ${pid}`);
  return { ...data, docs: { ...data.docs, [pid]: fn(doc) } };
}

function withItem(data: AppData, pid: string, id: string, fn: (it: Item, doc: ProjectDoc) => Item): AppData {
  return withDoc(data, pid, (doc) => {
    const it = doc.items[id];
    if (!it) throw new Error(`No Item ${id}`);
    return { ...doc, items: { ...doc.items, [id]: fn(it, doc) } };
  });
}

const content = (now: Timestamp) => ({ edited: now, contentAt: now });

/** A key after every existing key in `keys`. */
function keyAtEnd(keys: string[]): string {
  const max = keys.reduce<string | null>((m, k) => (m === null || k > m ? k : m), null);
  return keyBetween(max, null);
}

/** A key just after `prev` in manual (key) order, below any other key above it. */
function keyAfter(prev: string | null, keys: string[]): string {
  const above = keys.filter((k) => prev === null || k > prev);
  const next = above.reduce<string | null>((m, k) => (m === null || k < m ? k : m), null);
  return keyBetween(prev, next);
}

type Placed = { id: string; group: number; order: string };

/**
 * New order key for an element dropped at `index` of a displayed list (the list without the element).
 * Only neighbours in the same display group matter: a dated element keeps showing by date anyway.
 */
function dropKey(list: Placed[], index: number, group: number, allKeys = list.map((p) => p.order)): string {
  let prev: Placed | null = null;
  for (let i = index - 1; i >= 0; i--) {
    if (list[i].group === group) {
      prev = list[i];
      break;
    }
  }
  return keyAfter(prev?.order ?? null, allKeys);
}

const itemGroup = (it: Item) => (it.bottomed ? 2 : it.type === 'task' && it.due ? 0 : 1);

// ---- Projects --------------------------------------------------------------

/** A new Project goes to the end of the manual order and joins `workspace`, the one selected (ticket 02). */
export function addProject(data: AppData, p: { id: string; title: string }, now: Timestamp, workspace?: string | null): AppData {
  const order = keyAtEnd(Object.values(data.index.projectOrder).map((o) => o.order));
  const w = workspace ? data.index.workspaces[workspace] : undefined;
  const workspaces = w && workspace
    ? { ...data.index.workspaces, [workspace]: { ...w, projects: [...w.projects, p.id], at: now } }
    : data.index.workspaces;
  return {
    ...data,
    index: { ...data.index, projectOrder: { ...data.index.projectOrder, [p.id]: { order, at: now } }, workspaces },
    docs: {
      ...data.docs,
      [p.id]: {
        schema: 1,
        project: {
          id: p.id, title: p.title, crossed: false, crossedAt: null, crossSnap: null, bottomed: false, folded: false,
          created: now, edited: now, contentAt: now, positionAt: now,
        },
        items: {},
      },
    },
  };
}

export function renameProject(data: AppData, pid: string, title: string, now: Timestamp): AppData {
  return withDoc(data, pid, (doc) => ({ ...doc, project: { ...doc.project, title, ...content(now) } }));
}

export function setProjectFolded(data: AppData, pid: string, folded: boolean, now: Timestamp): AppData {
  return withDoc(data, pid, (doc) => ({ ...doc, project: { ...doc.project, folded, positionAt: now } }));
}

/**
 * Drag a Project to `index` of the displayed Project list: `shown` is that list when a Workspace hides some
 * Projects. It lands just after its new upper neighbour in the one manual order.
 */
export function moveProject(data: AppData, pid: string, index: number, now: Timestamp, shown?: string[]): AppData {
  const group = (id: string) => (data.docs[id].project.bottomed ? 2 : projectSortDate(data.docs[id]) ? 0 : 1);
  const list = (shown ?? sortedProjectIds(data))
    .filter((id) => id !== pid)
    .map((id) => ({ id, group: group(id), order: data.index.projectOrder[id]?.order ?? '' }));
  const allKeys = Object.entries(data.index.projectOrder).filter(([id]) => id !== pid).map(([, o]) => o.order);
  const order = dropKey(list, index, group(pid), allKeys);
  return {
    ...data,
    index: { ...data.index, projectOrder: { ...data.index.projectOrder, [pid]: { order, at: now } } },
  };
}

// ---- Items: adding and content ----------------------------------------------

export type NewItem = { id: string; type: ItemType; text: string; parent: string | null; due?: DateOnly | null };

export function addItem(data: AppData, pid: string, n: NewItem, now: Timestamp): AppData {
  return withDoc(data, pid, (doc) => {
    const parent = n.parent ? doc.items[n.parent] : null;
    if (n.parent && !parent) throw new Error('Parent not found');
    if (parent && parent.type !== 'task') throw new Error('Only Tasks have children');
    if (n.type === 'note' && !parent) throw new Error('A Note must sit under a Task');
    if (n.type === 'note' && n.due) throw new Error('Only Tasks have a due date');
    const siblings = Object.values(doc.items).filter((i) => i.parent === n.parent);
    const it: Item = {
      id: n.id, type: n.type, text: n.text, due: n.due ?? null,
      crossed: false, crossedAt: null, crossSnap: null,
      parent: n.parent, order: keyAtEnd(siblings.map((s) => s.order)), bottomed: false, folded: false,
      created: now, edited: now, contentAt: now, positionAt: now,
    };
    return { ...doc, items: { ...doc.items, [it.id]: it } };
  });
}

/** Drop a just-added Item left empty. Not a Delete: nothing is logged. */
export function discardItem(data: AppData, pid: string, id: string): AppData {
  return withDoc(data, pid, (doc) => {
    if (Object.values(doc.items).some((i) => i.parent === id)) throw new Error('Item has children');
    const { [id]: _gone, ...items } = doc.items;
    return { ...doc, items };
  });
}

export function editText(data: AppData, pid: string, id: string, text: string, now: Timestamp): AppData {
  return withItem(data, pid, id, (it) => ({ ...it, text, ...content(now) }));
}

export function setDue(data: AppData, pid: string, id: string, due: DateOnly | null, now: Timestamp): AppData {
  return withItem(data, pid, id, (it) => {
    if (it.type !== 'task') throw new Error('Only Tasks have a due date');
    return { ...it, due, ...content(now) };
  });
}

export function makeTask(data: AppData, pid: string, id: string, now: Timestamp): AppData {
  return withItem(data, pid, id, (it) => {
    if (it.type !== 'note') throw new Error('Only a Note can become a Task');
    return { ...it, type: 'task', ...content(now) };
  });
}

// ---- Items: position ------------------------------------------------------

export function setFolded(data: AppData, pid: string, id: string, folded: boolean, now: Timestamp): AppData {
  return withItem(data, pid, id, (it) => ({ ...it, folded, positionAt: now }));
}

/** Drag an Item to `index` of its displayed sibling list (same level only). */
export function moveItem(data: AppData, pid: string, id: string, index: number, now: Timestamp): AppData {
  return withItem(data, pid, id, (it, doc) => {
    const list = children(doc, it.parent)
      .filter((s) => s.id !== id)
      .map((s) => ({ id: s.id, group: itemGroup(s), order: s.order }));
    return { ...it, order: dropKey(list, index, itemGroup(it)), positionAt: now };
  });
}

/** The sibling displayed just above, if it is a Task the Item can move under. */
function indentTarget(doc: ProjectDoc, id: string): Item | null {
  const it = doc.items[id];
  const sibs = children(doc, it.parent);
  const above = sibs[sibs.findIndex((s) => s.id === id) - 1];
  return above && above.type === 'task' ? above : null;
}

export function canIndent(doc: ProjectDoc, id: string): boolean {
  return indentTarget(doc, id) !== null;
}

export function canOutdent(doc: ProjectDoc, id: string): boolean {
  const it = doc.items[id];
  if (!it.parent) return false;
  const grand = doc.items[it.parent]?.parent ?? null;
  return !(it.type === 'note' && grand === null);
}

export function indent(data: AppData, pid: string, id: string, now: Timestamp): AppData {
  return withItem(data, pid, id, (it, doc) => {
    const target = indentTarget(doc, id);
    if (!target) throw new Error('Nothing to indent under');
    const keys = Object.values(doc.items).filter((i) => i.parent === target.id).map((i) => i.order);
    return { ...it, parent: target.id, order: keyAtEnd(keys), positionAt: now };
  });
}

export function outdent(data: AppData, pid: string, id: string, now: Timestamp): AppData {
  return withItem(data, pid, id, (it, doc) => {
    if (!canOutdent(doc, id)) throw new Error('Cannot outdent');
    const oldParent = doc.items[it.parent!];
    const keys = Object.values(doc.items)
      .filter((i) => i.parent === oldParent.parent && i.id !== id)
      .map((i) => i.order);
    return { ...it, parent: oldParent.parent, order: keyAfter(oldParent.order, keys), positionAt: now };
  });
}

// ---- Moving between Projects, and the search jump ----------------------------

/** Open point 11: only Tasks move (a Note can't be top level). */
export function canMoveToProject(doc: ProjectDoc, id: string): boolean {
  return doc.items[id]?.type === 'task';
}

/** The Task and its branch go to the end of the other Project's top level. Ids stay the same. */
export function moveToProject(data: AppData, from: string, id: string, to: string, now: Timestamp): AppData {
  const src = data.docs[from];
  const dst = data.docs[to];
  if (!src || !dst || from === to) throw new Error('Pick another Project');
  if (!canMoveToProject(src, id)) throw new Error('Only Tasks can move to another Project');
  const branch = new Set<string>([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const it of Object.values(src.items)) {
      if (it.parent && branch.has(it.parent) && !branch.has(it.id)) {
        branch.add(it.id);
        grew = true;
      }
    }
  }
  const order = keyAtEnd(Object.values(dst.items).filter((i) => i.parent === null).map((i) => i.order));
  const kept: Record<string, Item> = {};
  const moved: Record<string, Item> = {};
  for (const it of Object.values(src.items)) {
    if (!branch.has(it.id)) kept[it.id] = it;
    else moved[it.id] = it.id === id ? { ...it, parent: null, order, positionAt: now } : { ...it, positionAt: now };
  }
  return {
    ...data,
    docs: {
      ...data.docs,
      [from]: { ...src, items: kept },
      [to]: { ...dst, items: { ...dst.items, ...moved } },
    },
  };
}

/** Unfold every folded parent so the Item can be seen (search jump). Unchanged data if nothing is folded. */
export function reveal(data: AppData, pid: string, id: string, now: Timestamp): AppData {
  const doc = data.docs[pid];
  let out = data;
  for (let p = doc?.items[id]?.parent ?? null; p && doc.items[p]; p = doc.items[p].parent) {
    if (doc.items[p].folded) out = setFolded(out, pid, p, false, now);
  }
  return out;
}
