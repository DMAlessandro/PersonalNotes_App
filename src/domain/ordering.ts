// Spec §4.1 and §2.2: how siblings and Projects are ordered, and the values derived from a Project.
import type { AppData, DateOnly, Item, ProjectDoc } from './model';

type Sortable = { due: DateOnly | null; bottomed: boolean; order: string };

/** Dated (not sent to bottom) by date, then the rest by manual order, then those sent to the bottom. */
function compare(a: Sortable, b: Sortable): number {
  const group = (s: Sortable) => (s.bottomed ? 2 : s.due ? 0 : 1);
  const g = group(a) - group(b);
  if (g) return g;
  if (group(a) === 0 && a.due !== b.due) return a.due! < b.due! ? -1 : 1;
  return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
}

const ownDue = (i: Item) => (i.type === 'task' ? i.due : null);

/** The children of `parent` (null = top level), in display order. */
export function children(doc: ProjectDoc, parent: string | null): Item[] {
  return Object.values(doc.items)
    .filter((i) => i.parent === parent)
    .sort((a, b) => compare({ ...a, due: ownDue(a) }, { ...b, due: ownDue(b) }));
}

/** Every Task of the Project in display order, with its depth (0 = top level). Notes are skipped. */
export function taskOutline(doc: ProjectDoc): { item: Item; depth: number }[] {
  const out: { item: Item; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const it of children(doc, parent)) {
      if (it.type !== 'task') continue;
      out.push({ item: it, depth });
      walk(it.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function hasChildren(doc: ProjectDoc, id: string): boolean {
  return Object.values(doc.items).some((i) => i.parent === id);
}

function minDate(dates: (DateOnly | null)[]): DateOnly | null {
  return dates.reduce<DateOnly | null>((m, d) => (d && (!m || d < m) ? d : m), null);
}

/** Deadline chip: earliest due date among open Tasks at any depth. */
export function projectDeadline(doc: ProjectDoc): DateOnly | null {
  return minDate(Object.values(doc.items).filter((i) => !i.crossed).map(ownDue));
}

/** Sort date: earliest due among all Tasks, ticked or not, skipping branches sent to the bottom. */
export function projectSortDate(doc: ProjectDoc): DateOnly | null {
  const skipped = (i: Item): boolean => {
    for (let cur: Item | undefined = i; cur; cur = cur.parent ? doc.items[cur.parent] : undefined) {
      if (cur.bottomed) return true;
    }
    return false;
  };
  return minDate(Object.values(doc.items).filter((i) => !skipped(i)).map(ownDue));
}

/** Every Project id in display order (spec §4.1 applied to Projects). */
export function sortedProjectIds(data: AppData): string[] {
  const key = (id: string): Sortable => ({
    due: projectSortDate(data.docs[id]),
    bottomed: data.docs[id].project.bottomed,
    order: data.index.projectOrder[id]?.order ?? '',
  });
  return Object.keys(data.docs).sort((a, b) => compare(key(a), key(b)));
}

/** Crossed direct children over direct children; null when there are none. */
export function progress(doc: ProjectDoc, id: string): { done: number; total: number } | null {
  const kids = Object.values(doc.items).filter((i) => i.parent === id);
  if (!kids.length) return null;
  return { done: kids.filter((k) => k.crossed).length, total: kids.length };
}

export function openTaskCount(doc: ProjectDoc): number {
  return Object.values(doc.items).filter((i) => i.type === 'task' && !i.crossed).length;
}
