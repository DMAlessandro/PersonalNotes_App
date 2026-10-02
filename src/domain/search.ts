// Ticket 10 / spec §5.4: plain, case-insensitive search of Item text across all Projects.
import type { AppData, Item } from './model';
import { children, sortedProjectIds } from './ordering';

export type SearchResult = {
  pid: string;
  projectTitle: string;
  item: Item;
  /** First lines of the parent Tasks, top level first. */
  path: string[];
};

export type SearchOptions = {
  /** The current Workspace (null = All Projects: no "Other Projects" section). */
  workspace: string | null;
  /** "Has due date": only dated Tasks, nearest first. */
  dueOnly: boolean;
};

const firstLine = (t: string) => t.split('\n')[0];

export function search(data: AppData, query: string, opt: SearchOptions): { here: SearchResult[]; other: SearchResult[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { here: [], other: [] };
  const members = opt.workspace ? new Set(data.index.workspaces[opt.workspace]?.projects ?? []) : null;

  // Walk every Project in display order, each in outline order, so ties keep the order the user sees.
  const found: SearchResult[] = [];
  for (const pid of sortedProjectIds(data)) {
    const doc = data.docs[pid];
    const walk = (parent: string | null, path: string[]) => {
      for (const it of children(doc, parent)) {
        const dated = it.type === 'task' && !!it.due;
        if (it.text.toLowerCase().includes(q) && (!opt.dueOnly || dated)) {
          found.push({ pid, projectTitle: doc.project.title, item: it, path });
        }
        walk(it.id, [...path, firstLine(it.text)]);
      }
    };
    walk(null, []);
  }

  const rank = (r: SearchResult) => (r.item.crossed ? 1 : 0);
  const sorted = found
    .map((r, n) => ({ r, n }))
    .sort((a, b) => {
      const c = rank(a.r) - rank(b.r);
      if (c) return c;
      if (opt.dueOnly && a.r.item.due !== b.r.item.due) return a.r.item.due! < b.r.item.due! ? -1 : 1;
      return a.n - b.n;
    })
    .map((x) => x.r);
  return {
    here: sorted.filter((r) => !members || members.has(r.pid)),
    other: members ? sorted.filter((r) => !members.has(r.pid)) : [],
  };
}
