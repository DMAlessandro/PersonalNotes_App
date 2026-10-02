// Spec §2.1 structural rules. Every edit keeps them; the merge (slice 5) repairs breaks.
import type { ProjectDoc } from './model';

export type Problem = { id: string; rule: string };

export function problems(doc: ProjectDoc): Problem[] {
  const out: Problem[] = [];
  for (const it of Object.values(doc.items)) {
    const parent = it.parent ? doc.items[it.parent] : null;
    if (it.parent && !parent) out.push({ id: it.id, rule: 'parent missing' });
    if (parent && parent.type !== 'task') out.push({ id: it.id, rule: 'parent is not a Task' });
    if (it.type === 'note' && it.parent === null) out.push({ id: it.id, rule: 'Note at top level' });
    if (it.type === 'note' && it.due) out.push({ id: it.id, rule: 'Note with a due date' });
    const seen = new Set<string>();
    for (let cur = it.parent; cur && doc.items[cur]; cur = doc.items[cur].parent) {
      if (cur === it.id || seen.has(cur)) {
        out.push({ id: it.id, rule: 'cycle' });
        break;
      }
      seen.add(cur);
    }
  }
  return out;
}
