// Spec §6.2: three-way merge of this device's data (local) and the other device's (remote) against the
// last pulled version (base), record by record across all Projects. Pure; written test-first.
import type { AppData, Item, Project, ProjectDoc, Timestamp, Workspace } from './model';
import { newId } from './ids';
import { keyBetween } from './orderKey';
import { canonical } from './canonical';

export type Clash = {
  kind: 'item' | 'project';
  /** Item id, or Project id for a Project clash. */
  id: string;
  /** The Project the Item is in after merging. */
  pid: string;
  /** Content fields changed differently on both sides. */
  fields: string[];
  local: Item | Project;
  remote: Item | Project;
};

export type MergeResult = { result: AppData; clashes: Clash[] };

type Placed = { pid: string; it: Item };

const time = (t: Timestamp | undefined) => (t ? Date.parse(t) : 0);
const later = (a: Timestamp, b: Timestamp) => (time(a) >= time(b) ? a : b);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

function flatten(d: AppData): Map<string, Placed> {
  const m = new Map<string, Placed>();
  for (const doc of Object.values(d.docs)) for (const it of Object.values(doc.items)) m.set(it.id, { pid: doc.project.id, it });
  return m;
}

/** Three-way pick of one value: one-sided changes win; both changed differently = conflict (local kept). */
function pick<T>(b: T | undefined, l: T, r: T, hasBase: boolean): { v: T; conflict: boolean } {
  if (same(l, r)) return { v: l, conflict: false };
  if (hasBase && same(b, l)) return { v: r, conflict: false };
  if (hasBase && same(b, r)) return { v: l, conflict: false };
  return { v: l, conflict: true };
}

/** Same, but a conflict is settled by the later of two timestamps (position fields, names, order). */
function pickLater<T>(b: T | undefined, l: T, r: T, hasBase: boolean, lAt: Timestamp, rAt: Timestamp): T {
  const p = pick(b, l, r, hasBase);
  return p.conflict ? (time(rAt) > time(lAt) ? r : l) : p.v;
}

const itemContentChanged = (b: Item, x: Item) =>
  b.text !== x.text || b.due !== x.due || b.crossed !== x.crossed || b.type !== x.type;
const projectContentChanged = (b: Project, x: Project) => b.title !== x.title || b.crossed !== x.crossed;

function mergeItem(b: Placed | undefined, l: Placed, r: Placed): { v: Placed; fields: string[] } {
  const has = !!b;
  const fields: string[] = [];
  const content = <K extends 'text' | 'due'>(k: K) => {
    const p = pick(b?.it[k], l.it[k], r.it[k], has);
    if (p.conflict) fields.push(k);
    return p.v;
  };
  const text = content('text');
  const due = content('due');
  // Ticking is a yes/no: two sides can't change it "differently" from the base. Its date and snapshot follow it.
  const crossedFromRemote = has ? same(b!.it.crossed, l.it.crossed) && !same(b!.it.crossed, r.it.crossed) : false;
  const crossSide = crossedFromRemote ? r.it : l.it;
  const type = l.it.type === 'task' || r.it.type === 'task' ? 'task' : 'note';
  const place = pickLater(
    b && { pid: b.pid, parent: b.it.parent, order: b.it.order },
    { pid: l.pid, parent: l.it.parent, order: l.it.order },
    { pid: r.pid, parent: r.it.parent, order: r.it.order },
    has,
    l.it.positionAt,
    r.it.positionAt,
  );
  const pos = <K extends 'bottomed' | 'folded'>(k: K) => pickLater(b?.it[k], l.it[k], r.it[k], has, l.it.positionAt, r.it.positionAt);
  const it: Item = {
    ...l.it,
    type,
    text,
    due: type === 'task' ? due : null,
    crossed: crossSide.crossed,
    crossedAt: crossSide.crossedAt,
    crossSnap: crossSide.crossSnap,
    parent: place.parent,
    order: place.order,
    bottomed: pos('bottomed'),
    folded: pos('folded'),
    created: b?.it.created ?? l.it.created,
    edited: later(l.it.edited, r.it.edited),
    contentAt: later(l.it.contentAt, r.it.contentAt),
    positionAt: later(l.it.positionAt, r.it.positionAt),
  };
  return { v: { pid: place.pid, it }, fields };
}

function mergeProject(b: Project | undefined, l: Project, r: Project): { v: Project; fields: string[] } {
  const has = !!b;
  const fields: string[] = [];
  const title = pick(b?.title, l.title, r.title, has);
  if (title.conflict) fields.push('title');
  const crossedFromRemote = has ? b!.crossed === l.crossed && b!.crossed !== r.crossed : false;
  const cs = crossedFromRemote ? r : l;
  const pos = <K extends 'bottomed' | 'folded'>(k: K) => pickLater(b?.[k], l[k], r[k], has, l.positionAt, r.positionAt);
  return {
    v: {
      ...l,
      title: title.v,
      crossed: cs.crossed,
      crossedAt: cs.crossedAt,
      crossSnap: cs.crossSnap,
      bottomed: pos('bottomed'),
      folded: pos('folded'),
      created: b?.created ?? l.created,
      edited: later(l.edited, r.edited),
      contentAt: later(l.contentAt, r.contentAt),
      positionAt: later(l.positionAt, r.positionAt),
    },
    fields,
  };
}

/** Generic record merge: added / deleted / edit-beats-delete / both present. */
function mergeRecords<T>(
  ids: Iterable<string>,
  get: (side: 'b' | 'l' | 'r', id: string) => T | undefined,
  contentChanged: (b: T, x: T) => boolean,
  both: (b: T | undefined, l: T, r: T) => T,
): Map<string, T> {
  const out = new Map<string, T>();
  for (const id of ids) {
    const b = get('b', id);
    const l = get('l', id);
    const r = get('r', id);
    if (l && r) out.set(id, both(b, l, r));
    else if (l && !r) {
      if (!b) out.set(id, l); // added here
      else if (contentChanged(b, l)) out.set(id, l); // deleted there, edited here: the edit wins
    } else if (r && !l) {
      if (!b) out.set(id, r);
      else if (contentChanged(b, r)) out.set(id, r);
    }
  }
  return out;
}

export function merge(base: AppData, local: AppData, remote: AppData): MergeResult {
  const B = flatten(base);
  const L = flatten(local);
  const R = flatten(remote);
  const clashes: Clash[] = [];

  // ---- Items
  const sides = { b: B, l: L, r: R };
  const items = mergeRecords<Placed>(
    new Set([...B.keys(), ...L.keys(), ...R.keys()]),
    (s, id) => sides[s].get(id),
    (b, x) => itemContentChanged(b.it, x.it),
    (b, l, r) => {
      const m = mergeItem(b, l, r);
      if (m.fields.length) clashes.push({ kind: 'item', id: l.it.id, pid: m.v.pid, fields: m.fields, local: l.it, remote: r.it });
      return m.v;
    },
  );

  // ---- Projects
  const proj = (d: AppData, id: string) => d.docs[id]?.project;
  const projects = mergeRecords<Project>(
    new Set([...Object.keys(base.docs), ...Object.keys(local.docs), ...Object.keys(remote.docs)]),
    (s, id) => proj(s === 'b' ? base : s === 'l' ? local : remote, id),
    projectContentChanged,
    (b, l, r) => {
      const m = mergeProject(b, l, r);
      if (m.fields.length) clashes.push({ kind: 'project', id: l.id, pid: l.id, fields: m.fields, local: l, remote: r });
      return m.v;
    },
  );

  // ---- Repair 1: bring back parents and Projects that a kept Item needs (edit beats Delete)
  const source = (id: string) => R.get(id) ?? L.get(id) ?? B.get(id);
  for (let changed = true; changed; ) {
    changed = false;
    for (const { pid, it } of [...items.values()]) {
      if (it.parent && !items.has(it.parent)) {
        const p = source(it.parent);
        if (p) {
          items.set(p.it.id, p);
          changed = true;
        } else {
          items.set(it.id, { pid, it: { ...it, parent: null } });
        }
      }
      if (!projects.has(pid)) {
        const p = proj(remote, pid) ?? proj(local, pid) ?? proj(base, pid);
        if (p) {
          projects.set(pid, p);
          changed = true;
        }
      }
    }
  }

  // ---- Repair 2: cycles — undo the earlier of the moves involved
  for (const { it } of items.values()) {
    const seen: string[] = [];
    for (let cur: string | null = it.id; cur && items.has(cur); cur = items.get(cur)!.it.parent) {
      if (seen.includes(cur)) {
        const loop = seen.slice(seen.indexOf(cur)).map((id) => items.get(id)!);
        const earliest = loop.reduce((a, c) => (time(c.it.positionAt) < time(a.it.positionAt) ? c : a));
        const was = B.get(earliest.it.id);
        const parent = was && was.it.parent && !loop.some((x) => x.it.id === was.it.parent) ? was.it.parent : null;
        items.set(earliest.it.id, { ...earliest, it: { ...earliest.it, parent, order: was?.it.order ?? earliest.it.order } });
        break;
      }
      seen.push(cur);
    }
  }

  // ---- Repair 3: Notes only under Tasks
  for (const [id, p] of items) {
    if (p.it.type !== 'note') continue;
    if (p.it.parent === null) items.set(id, { ...p, it: { ...p.it, type: 'task' } });
    else {
      const parent = items.get(p.it.parent);
      if (parent && parent.it.type === 'note') items.set(parent.it.id, { ...parent, it: { ...parent.it, type: 'task' } });
    }
  }
  // An Item's parent must be in the same Project: a parent moved away takes the child along.
  for (const [id, p] of items) {
    const parent = p.it.parent ? items.get(p.it.parent) : null;
    if (parent && parent.pid !== p.pid) items.set(id, { ...p, pid: parent.pid });
  }

  // ---- Repair 4: duplicate order keys among siblings
  const groups = new Map<string, Placed[]>();
  for (const p of items.values()) {
    const k = `${p.pid}/${p.it.parent ?? ''}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (a.it.order < b.it.order ? -1 : a.it.order > b.it.order ? 1 : time(a.it.positionAt) - time(b.it.positionAt)));
    for (let i = 1; i < list.length; i++) {
      if (list[i].it.order !== list[i - 1].it.order) continue;
      const next = list.slice(i + 1).find((x) => x.it.order > list[i].it.order)?.it.order ?? null;
      const order = keyBetween(list[i - 1].it.order, next);
      list[i] = { ...list[i], it: { ...list[i].it, order } };
      items.set(list[i].it.id, list[i]);
    }
  }

  // ---- Index: Project order (later change wins) and Workspaces (membership as sets)
  const projectOrder: AppData['index']['projectOrder'] = {};
  for (const pid of projects.keys()) {
    const b = base.index.projectOrder[pid];
    const l = local.index.projectOrder[pid];
    const r = remote.index.projectOrder[pid];
    const v = l && r ? pickLater(b?.order, l.order, r.order, !!b, l.at, r.at) : (l ?? r ?? b)?.order;
    const at = l && r ? later(l.at, r.at) : (l ?? r ?? b)?.at;
    if (v && at) projectOrder[pid] = { order: v, at };
  }
  for (const pid of projects.keys()) {
    if (!projectOrder[pid]) {
      const max = Object.values(projectOrder).reduce<string | null>((m, o) => (m === null || o.order > m ? o.order : m), null);
      projectOrder[pid] = { order: keyBetween(max, null), at: projects.get(pid)!.positionAt };
    }
  }

  const workspaces: Record<string, Workspace> = {};
  const wids = new Set([...Object.keys(base.index.workspaces), ...Object.keys(local.index.workspaces), ...Object.keys(remote.index.workspaces)]);
  for (const id of wids) {
    const b = base.index.workspaces[id];
    const l = local.index.workspaces[id];
    const r = remote.index.workspaces[id];
    let w: Workspace | undefined;
    if (l && r) {
      const inB = new Set(b?.projects ?? []);
      const all = [...new Set([...l.projects, ...r.projects, ...inB])];
      const keep = all.filter((p) => {
        const inL = l.projects.includes(p);
        const inR = r.projects.includes(p);
        return inB.has(p) ? inL && inR : inL || inR;
      });
      w = { name: pickLater(b?.name, l.name, r.name, !!b, l.at, r.at), projects: keep, at: later(l.at, r.at) };
    } else if (l || r) {
      const x = (l ?? r)!;
      w = !b || !same(b, x) ? x : undefined; // deleted on one side, untouched on the other: gone
    }
    if (w) workspaces[id] = { ...w, projects: w.projects.filter((p) => projects.has(p)) };
  }

  // ---- Assemble
  const docs: Record<string, ProjectDoc> = {};
  for (const [pid, project] of projects) docs[pid] = { schema: 1, project, items: {} };
  for (const { pid, it } of items.values()) if (docs[pid]) docs[pid].items[it.id] = it;

  return {
    result: {
      index: { schema: 1, projectOrder, workspaces },
      docs,
      log: { ...remote.log, ...local.log },
    },
    clashes,
  };
}

/** Spec §5.6: Keep this device's / Keep the other's / Keep both (the other version as a sibling right after). */
export function resolveClash(data: AppData, c: Clash, choice: 'this' | 'other' | 'both', now: Timestamp): AppData {
  if (choice === 'this') return data;
  const doc = data.docs[c.pid];
  if (!doc) return data;

  if (c.kind === 'project') {
    const r = c.remote as Project;
    if (choice === 'other' || choice === 'both') {
      const project = { ...doc.project, title: r.title, contentAt: now, edited: now };
      return { ...data, docs: { ...data.docs, [c.pid]: { ...doc, project } } };
    }
    return data;
  }

  const cur = doc.items[c.id];
  if (!cur) return data;
  const r = c.remote as Item;
  const theirs: Partial<Item> = {};
  for (const f of c.fields) (theirs as Record<string, unknown>)[f] = (r as Record<string, unknown>)[f];

  if (choice === 'other') {
    const it = { ...cur, ...theirs, contentAt: now, edited: now };
    return { ...data, docs: { ...data.docs, [c.pid]: { ...doc, items: { ...doc.items, [c.id]: it } } } };
  }

  const next = Object.values(doc.items)
    .filter((s) => s.parent === cur.parent && s.order > cur.order)
    .reduce<string | null>((m, s) => (m === null || s.order < m ? s.order : m), null);
  const copy: Item = {
    ...cur,
    ...theirs,
    id: newId('i'),
    order: keyBetween(cur.order, next),
    crossSnap: null,
    folded: false,
    created: now,
    edited: now,
    contentAt: now,
    positionAt: now,
  };
  return { ...data, docs: { ...data.docs, [c.pid]: { ...doc, items: { ...doc.items, [copy.id]: copy } } } };
}
