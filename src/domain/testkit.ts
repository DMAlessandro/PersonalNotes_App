// Small builders for tests: readable fixtures without repeating every field.
import type { AppData, Item, Project, ProjectDoc } from './model';

const T = '2026-10-01T10:00:00+02:00';

export function project(id: string, over: Partial<Project> = {}): Project {
  return {
    id, title: id, crossed: false, crossedAt: null, crossSnap: null, bottomed: false, folded: false,
    created: T, edited: T, contentAt: T, positionAt: T, ...over,
  };
}

export function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id, type: 'task', text: id, due: null, crossed: false, crossedAt: null, crossSnap: null,
    parent: null, order: 'V', bottomed: false, folded: false,
    created: T, edited: T, contentAt: T, positionAt: T, ...over,
  };
}

export function doc(p: Project | string, items: Item[] = []): ProjectDoc {
  const pr = typeof p === 'string' ? project(p) : p;
  return { schema: 1, project: pr, items: Object.fromEntries(items.map((i) => [i.id, i])) };
}

export function data(docs: ProjectDoc[], order: Record<string, string> = {}): AppData {
  return {
    index: {
      schema: 1,
      projectOrder: Object.fromEntries(
        docs.map((d, n) => [d.project.id, { order: order[d.project.id] ?? `V${n + 1}`, at: T }]),
      ),
      workspaces: {},
    },
    docs: Object.fromEntries(docs.map((d) => [d.project.id, d])),
    log: {},
  };
}
