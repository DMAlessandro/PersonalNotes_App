// Claude Sessions bridge, phase 3 (ticket 16): the user answers a session from the phone by writing a Note
// under one of its replies (or under the session Task) and Pushing. The bridge only ever makes Tasks,
// so any Note in the session's branch is the user's.
import type { Item, ProjectDoc } from '../domain/model';

/** Unsent answers in the branch of `taskId`, oldest first. `answered` = Note ids already passed to Claude. */
export function findAnswers(doc: ProjectDoc, taskId: string, answered: string[]): Item[] {
  const items = Object.values(doc.items);
  const inBranch = (it: Item): boolean => {
    for (let p = it.parent; p; p = doc.items[p]?.parent ?? null) if (p === taskId) return true;
    return false;
  };
  return items
    .filter((it) => it.type === 'note' && !it.crossed && it.text.trim() && !answered.includes(it.id) && inBranch(it))
    .sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : a.order < b.order ? -1 : 1));
}

const OFF = /(?:^|\s)#phoneoff(?=\s|$|[.,;:!?])/gi;

/** The text handed to Claude; `off` when an answer says #phoneoff (stop sending this session's replies). */
export function answerMessage(texts: string[]): { text: string; off: boolean } {
  const off = texts.some((t) => new RegExp(OFF.source, 'i').test(t));
  const text = texts.map((t) => t.replace(OFF, ' ').trim()).filter(Boolean).join('\n\n');
  return { text, off };
}
