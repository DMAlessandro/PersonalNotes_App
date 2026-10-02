// Spec §4.2 / §4.3 / §5.5: Cross out, Un-cross, ↓ bottom, Delete and Restore, for Items and Projects.
// Cross-outs and Deletes add a Change-log entry with the full content; Un-cross is not logged (open point 7).
import type { AppData, Item, LogEntry, ProjectDoc, Timestamp } from './model';
import { newId } from './ids';
import { keyBetween } from './orderKey';

// ---- helpers ---------------------------------------------------------------

function docOf(data: AppData, pid: string): ProjectDoc {
  const doc = data.docs[pid];
  if (!doc) throw new Error(`No Project ${pid}`);
  return doc;
}

function itemOf(doc: ProjectDoc, id: string): Item {
  const it = doc.items[id];
  if (!it) throw new Error(`No Item ${id}`);
  return it;
}

function descendants(doc: ProjectDoc, id: string): Item[] {
  const out: Item[] = [];
  const walk = (parent: string) => {
    for (const it of Object.values(doc.items)) {
      if (it.parent === parent) {
        out.push(it);
        walk(it.id);
      }
    }
  };
  walk(id);
  return out;
}

function keyAtEnd(keys: string[]): string {
  return keyBetween(keys.reduce<string | null>((m, k) => (m === null || k > m ? k : m), null), null);
}

function workspacesOf(data: AppData, pid: string): string[] {
  return Object.entries(data.index.workspaces)
    .filter(([, w]) => w.projects.includes(pid))
    .map(([id]) => id);
}

function entry(
  data: AppData,
  doc: ProjectDoc,
  action: LogEntry['action'],
  item: Item | null,
  branch: Item[],
  now: Timestamp,
  device: string,
  restores?: string,
): LogEntry {
  const ancestors: Item[] = [];
  for (let p = item?.parent ?? null; p && doc.items[p]; p = doc.items[p].parent) ancestors.push(doc.items[p]);
  return {
    id: newId('c'),
    action,
    at: now,
    device,
    projectId: doc.project.id,
    projectTitle: doc.project.title,
    itemId: item?.id ?? null,
    text: item ? item.text : doc.project.title,
    count: branch.length,
    branch: Object.fromEntries(branch.map((i) => [i.id, i])),
    ancestors,
    project: doc.project,
    projectOrder: data.index.projectOrder[doc.project.id]?.order ?? null,
    workspaces: workspacesOf(data, doc.project.id),
    ...(restores ? { restores } : {}),
  };
}

const addLog = (data: AppData, e: LogEntry): AppData => ({ ...data, log: { ...data.log, [e.id]: e } });

/** Cross out `items`, remembering each one's state in a snapshot. Already-crossed ones keep their date. */
function crossAll(items: Item[], now: Timestamp): { changed: Record<string, Item>; snap: Record<string, boolean> } {
  const changed: Record<string, Item> = {};
  const snap: Record<string, boolean> = {};
  for (const d of items) {
    snap[d.id] = d.crossed;
    if (!d.crossed) changed[d.id] = { ...d, crossed: true, crossedAt: now, contentAt: now };
  }
  return { changed, snap };
}

/** Put items back as recorded in `snap`. Items not in the snapshot (added later) are left alone. */
function restoreSnap(doc: ProjectDoc, snap: Record<string, boolean> | null, now: Timestamp): Record<string, Item> {
  const changed: Record<string, Item> = {};
  for (const [id, was] of Object.entries(snap ?? {})) {
    const d = doc.items[id];
    if (d && d.crossed !== was) {
      changed[id] = { ...d, crossed: was, crossedAt: was ? d.crossedAt : null, contentAt: now };
    }
  }
  return changed;
}

// ---- Items -----------------------------------------------------------------

export function crossOut(data: AppData, pid: string, id: string, now: Timestamp, device: string): AppData {
  const doc = docOf(data, pid);
  const it = itemOf(doc, id);
  if (it.crossed) return data;
  const desc = descendants(doc, id);
  const { changed, snap } = crossAll(desc, now);
  const crossedItem: Item = {
    ...it, crossed: true, crossedAt: now, crossSnap: snap, folded: desc.length > 0 ? true : it.folded,
    contentAt: now, positionAt: desc.length > 0 && !it.folded ? now : it.positionAt,
  };
  const nextDoc = { ...doc, items: { ...doc.items, ...changed, [id]: crossedItem } };
  const next = { ...data, docs: { ...data.docs, [pid]: nextDoc } };
  return addLog(next, entry(data, doc, 'crossed', it, [it, ...desc], now, device));
}

export function uncross(data: AppData, pid: string, id: string, now: Timestamp): AppData {
  const doc = docOf(data, pid);
  const it = itemOf(doc, id);
  if (!it.crossed) return data;
  const changed = restoreSnap(doc, it.crossSnap, now);
  const back: Item = {
    ...it, crossed: false, crossedAt: null, crossSnap: null, bottomed: false, folded: false,
    contentAt: now, positionAt: it.bottomed || it.folded ? now : it.positionAt,
  };
  return { ...data, docs: { ...data.docs, [pid]: { ...doc, items: { ...doc.items, ...changed, [id]: back } } } };
}

export function sendToBottom(data: AppData, pid: string, id: string, now: Timestamp): AppData {
  const doc = docOf(data, pid);
  const it = itemOf(doc, id);
  if (!it.crossed) throw new Error('Only a crossed-out Item can go to the bottom');
  const keys = Object.values(doc.items).filter((s) => s.parent === it.parent && s.id !== id).map((s) => s.order);
  const moved: Item = { ...it, bottomed: true, order: keyAtEnd(keys), positionAt: now };
  return { ...data, docs: { ...data.docs, [pid]: { ...doc, items: { ...doc.items, [id]: moved } } } };
}

export function deleteItem(data: AppData, pid: string, id: string, now: Timestamp, device: string): AppData {
  const doc = docOf(data, pid);
  const it = itemOf(doc, id);
  if (!it.crossed) throw new Error('Cross out first, then Delete');
  const branch = [it, ...descendants(doc, id)];
  const gone = new Set(branch.map((b) => b.id));
  const items = Object.fromEntries(Object.entries(doc.items).filter(([k]) => !gone.has(k)));
  const next = { ...data, docs: { ...data.docs, [pid]: { ...doc, items } } };
  return addLog(next, entry(data, doc, 'deleted', it, branch, now, device));
}

// ---- Projects --------------------------------------------------------------

export function crossProject(data: AppData, pid: string, now: Timestamp, device: string): AppData {
  const doc = docOf(data, pid);
  if (doc.project.crossed) return data;
  const all = Object.values(doc.items);
  const { changed, snap } = crossAll(all, now);
  const project = { ...doc.project, crossed: true, crossedAt: now, crossSnap: snap, folded: true, contentAt: now };
  const next = { ...data, docs: { ...data.docs, [pid]: { ...doc, project, items: { ...doc.items, ...changed } } } };
  return addLog(next, entry(data, doc, 'crossed', null, all, now, device));
}

export function uncrossProject(data: AppData, pid: string, now: Timestamp): AppData {
  const doc = docOf(data, pid);
  if (!doc.project.crossed) return data;
  const changed = restoreSnap(doc, doc.project.crossSnap, now);
  const project = {
    ...doc.project, crossed: false, crossedAt: null, crossSnap: null, bottomed: false, folded: false,
    contentAt: now, positionAt: now,
  };
  return { ...data, docs: { ...data.docs, [pid]: { ...doc, project, items: { ...doc.items, ...changed } } } };
}

export function sendProjectToBottom(data: AppData, pid: string, now: Timestamp): AppData {
  const doc = docOf(data, pid);
  if (!doc.project.crossed) throw new Error('Only a crossed-out Project can go to the bottom');
  const keys = Object.entries(data.index.projectOrder).filter(([k]) => k !== pid).map(([, o]) => o.order);
  return {
    ...data,
    docs: { ...data.docs, [pid]: { ...doc, project: { ...doc.project, bottomed: true, positionAt: now } } },
    index: { ...data.index, projectOrder: { ...data.index.projectOrder, [pid]: { order: keyAtEnd(keys), at: now } } },
  };
}

export function deleteProject(data: AppData, pid: string, now: Timestamp, device: string): AppData {
  const doc = docOf(data, pid);
  if (!doc.project.crossed) throw new Error('Cross out first, then Delete');
  const e = entry(data, doc, 'deleted', null, Object.values(doc.items), now, device);
  const { [pid]: _doc, ...docs } = data.docs;
  const { [pid]: _order, ...projectOrder } = data.index.projectOrder;
  const workspaces = Object.fromEntries(
    Object.entries(data.index.workspaces).map(([id, w]) =>
      w.projects.includes(pid) ? [id, { ...w, projects: w.projects.filter((p) => p !== pid), at: now }] : [id, w],
    ),
  );
  return addLog({ ...data, docs, index: { ...data.index, projectOrder, workspaces } }, e);
}

// ---- From the Change log ---------------------------------------------------

/** A Delete can be restored while what it removed is still gone. */
export function canRestore(data: AppData, e: LogEntry): boolean {
  if (e.action !== 'deleted') return false;
  const doc = data.docs[e.projectId];
  return e.itemId ? !doc?.items[e.itemId] : !doc;
}

/** Restore the chain: the Project and parent Tasks come back too if they are gone, so the Item lands where it was. */
export function restore(data: AppData, entryId: string, now: Timestamp, device: string): AppData {
  const e = data.log[entryId];
  if (!e || !canRestore(data, e)) throw new Error('Nothing to restore');
  let next = data;

  if (!next.docs[e.projectId]) {
    const keys = Object.values(next.index.projectOrder).map((o) => o.order);
    const order = e.projectOrder && !keys.includes(e.projectOrder) ? e.projectOrder : keyAtEnd(keys);
    const workspaces = Object.fromEntries(
      Object.entries(next.index.workspaces).map(([id, w]) =>
        e.workspaces.includes(id) && !w.projects.includes(e.projectId)
          ? [id, { ...w, projects: [...w.projects, e.projectId], at: now }]
          : [id, w],
      ),
    );
    next = {
      ...next,
      docs: { ...next.docs, [e.projectId]: { schema: 1, project: { ...e.project }, items: {} } },
      index: { ...next.index, projectOrder: { ...next.index.projectOrder, [e.projectId]: { order, at: now } }, workspaces },
    };
  }

  const doc = next.docs[e.projectId];
  const back: Record<string, Item> = {};
  for (const a of e.ancestors) if (!doc.items[a.id]) back[a.id] = a;
  for (const b of Object.values(e.branch)) if (!doc.items[b.id]) back[b.id] = b;
  next = { ...next, docs: { ...next.docs, [e.projectId]: { ...doc, items: { ...doc.items, ...back } } } };

  const item = e.itemId ? next.docs[e.projectId].items[e.itemId] : null;
  return addLog(next, entry(next, next.docs[e.projectId], 'restored', item, Object.values(e.branch), now, device, e.id));
}

/** A Cross-out entry offers Un-cross while that Item (or Project) is still crossed out. */
export function canUncrossEntry(data: AppData, e: LogEntry): boolean {
  if (e.action !== 'crossed') return false;
  const doc = data.docs[e.projectId];
  if (!doc) return false;
  return e.itemId ? !!doc.items[e.itemId]?.crossed : doc.project.crossed;
}

export function uncrossEntry(data: AppData, entryId: string, now: Timestamp): AppData {
  const e = data.log[entryId];
  if (!e || !canUncrossEntry(data, e)) throw new Error('Nothing to un-cross');
  return e.itemId ? uncross(data, e.projectId, e.itemId, now) : uncrossProject(data, e.projectId, now);
}
