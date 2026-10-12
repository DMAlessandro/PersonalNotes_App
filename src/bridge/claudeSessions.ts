// Claude Sessions bridge (ticket 16): replies from Claude Code sessions tagged "#phone" land in a Project
// "Claude Sessions", one Task per session, each reply a Subtask under it in order. Pure: AppData → AppData.
import { addItem, addProject } from '../domain/edits';
import type { AppData, Timestamp } from '../domain/model';

export const SESSIONS_TITLE = 'Claude Sessions';

/** One finished reply. `title` names the session's Task when it has to be made. */
export type Reply = { sid: string; title: string; text: string };

/** Claude Code session id → the id of its Task in the Claude Sessions Project. Kept on the laptop. */
export type SessionMap = Record<string, string>;

export function addReplies(
  data: AppData,
  replies: Reply[],
  sessions: SessionMap,
  now: Timestamp,
  makeId: (prefix: 'p' | 'i') => string,
): { data: AppData; sessions: SessionMap } {
  if (!replies.length) return { data, sessions };
  let d = data;
  let pid = Object.values(d.docs).find((doc) => doc.project.title === SESSIONS_TITLE && !doc.project.crossed)?.project.id;
  if (!pid) {
    pid = makeId('p');
    d = addProject(d, { id: pid, title: SESSIONS_TITLE }, now);
  }
  const map = { ...sessions };
  for (const r of replies) {
    const known = map[r.sid] ? d.docs[pid].items[map[r.sid]] : undefined;
    if (!known || known.crossed || known.type !== 'task') {
      map[r.sid] = makeId('i');
      d = addItem(d, pid, { id: map[r.sid], type: 'task', text: r.title, parent: null }, now);
    }
    d = addItem(d, pid, { id: makeId('i'), type: 'task', text: r.text, parent: map[r.sid] }, now);
  }
  return { data: d, sessions: map };
}
