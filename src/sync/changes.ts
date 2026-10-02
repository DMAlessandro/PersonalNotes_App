// Spec §2.2 "Unpushed count" and §6.3 commit message.
import type { AppData } from '../domain/model';

/** A record as compared for the unpushed count: folding (and the position stamp it moves) don't count. */
function strip<T extends { folded?: boolean; positionAt?: string }>(r: T | undefined): string | undefined {
  if (!r) return undefined;
  const { folded: _f, positionAt: _p, ...rest } = r;
  return JSON.stringify(rest);
}

type Change = { projectTitle: string | null };

/** Every Project, Item, Project-order and Workspace change between the last pulled data and now, folds ignored. */
function changes(base: AppData, cur: AppData): Change[] {
  const out: Change[] = [];
  const pids = new Set([...Object.keys(base.docs), ...Object.keys(cur.docs)]);
  for (const pid of pids) {
    const b = base.docs[pid];
    const c = cur.docs[pid];
    const title = (c ?? b).project.title;
    if (strip(b?.project) !== strip(c?.project)) out.push({ projectTitle: title });
    const ids = new Set([...Object.keys(b?.items ?? {}), ...Object.keys(c?.items ?? {})]);
    for (const id of ids) if (strip(b?.items[id]) !== strip(c?.items[id])) out.push({ projectTitle: title });
    // The order entry of a Project that came or went is part of that change, not another one.
    if (b && c && JSON.stringify(base.index.projectOrder[pid]?.order) !== JSON.stringify(cur.index.projectOrder[pid]?.order)) {
      out.push({ projectTitle: null });
    }
  }
  const wids = new Set([...Object.keys(base.index.workspaces), ...Object.keys(cur.index.workspaces)]);
  for (const w of wids) {
    const bw = base.index.workspaces[w];
    const cw = cur.index.workspaces[w];
    if (JSON.stringify(bw && { ...bw, at: 0 }) !== JSON.stringify(cw && { ...cw, at: 0 })) out.push({ projectTitle: null });
  }
  return out;
}

/** The "N unpushed" badge. */
export function countUnpushed(base: AppData, cur: AppData): number {
  return changes(base, cur).length;
}

/** `Phone: Grant proposal, Teaching (5 changes)`; `(folds only)` when only folds changed. */
export function commitMessage(device: string, base: AppData, cur: AppData): string {
  const list = changes(base, cur);
  const titles = [...new Set(list.map((c) => c.projectTitle).filter((t): t is string => !!t))].sort((a, b) =>
    a.localeCompare(b),
  );
  const shown = titles.length > 3 ? [...titles.slice(0, 3), `${titles.length - 3} more`] : titles;
  const what = shown.length ? shown.join(', ') : 'Projects';
  if (!list.length) return `${device}: ${what === 'Projects' ? 'folds' : what} (folds only)`;
  return `${device}: ${what} (${list.length} ${list.length === 1 ? 'change' : 'changes'})`;
}
