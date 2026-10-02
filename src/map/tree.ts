// Spec §5.3: the Map view shows the current Workspace as a tree. Sibling order is §4.1, folds are the List view's.
import type { AppData, DateOnly, Item } from '../domain/model';
import { children, progress, projectDeadline } from '../domain/ordering';
import { shownProjectIds } from '../domain/workspaces';

export type MapNode = {
  /** `ws`, `project:<id>` or `item:<id>`: stable across renders, used for sizes and positions. */
  key: string;
  kind: 'ws' | 'project' | 'item';
  pid: string | null;
  item: Item | null;
  label: string;
  kids: MapNode[];
  /** Has children, shown or folded away. */
  hasKids: boolean;
  /** Items hidden by this fold ("+N"); 0 when unfolded. */
  hidden: number;
  /** Item: its due date. Project: its deadline chip (earliest open due date). */
  due: DateOnly | null;
  /** Tasks with children: crossed / all direct children. */
  progress: { done: number; total: number } | null;
  crossed: boolean;
};

export function mapTree(data: AppData, wid: string | null): MapNode {
  const label = (wid && data.index.workspaces[wid]?.name) || 'All Projects';
  const projects = shownProjectIds(data, wid).map((pid): MapNode => {
    const doc = data.docs[pid];
    const count = (parent: string | null): number =>
      children(doc, parent).reduce((s, c) => s + 1 + count(c.id), 0);
    const itemNode = (it: Item): MapNode => {
      const kids = children(doc, it.id);
      return {
        key: `item:${it.id}`, kind: 'item', pid, item: it, label: it.text,
        kids: it.folded ? [] : kids.map(itemNode),
        hasKids: kids.length > 0,
        hidden: it.folded ? count(it.id) : 0,
        due: it.type === 'task' ? it.due : null,
        progress: progress(doc, it.id),
        crossed: it.crossed,
      };
    };
    const top = children(doc, null);
    return {
      key: `project:${pid}`, kind: 'project', pid, item: null, label: doc.project.title,
      kids: doc.project.folded ? [] : top.map(itemNode),
      hasKids: top.length > 0,
      hidden: doc.project.folded ? count(null) : 0,
      due: projectDeadline(doc),
      progress: null,
      crossed: doc.project.crossed,
    };
  });
  return { key: 'ws', kind: 'ws', pid: null, item: null, label, kids: projects, hasKids: projects.length > 0, hidden: 0, due: null, progress: null, crossed: false };
}
