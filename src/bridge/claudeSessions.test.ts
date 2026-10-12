import { describe, expect, it } from 'vitest';
import { addReplies, SESSIONS_TITLE, type Reply } from './claudeSessions';
import { addProject } from '../domain/edits';
import { crossOut } from '../domain/lifecycle';
import { children } from '../domain/ordering';
import { emptyData, type AppData } from '../domain/model';

const NOW = '2026-10-12T18:00:00.000+02:00';
let n = 0;
const ids = (p: 'p' | 'i') => `${p}_${++n}`;
const reply = (sid: string, text: string, title = `Proj · ${sid}`): Reply => ({ sid, title, text });

const sessionsProject = (d: AppData) => Object.values(d.docs).filter((x) => x.project.title === SESSIONS_TITLE);

describe('addReplies (Claude Sessions bridge)', () => {
  it('creates the Claude Sessions Project, one Task per session, each reply a Subtask in order', () => {
    const r = addReplies(emptyData(), [reply('A', 'one'), reply('A', 'two'), reply('B', 'beta')], {}, NOW, ids);
    const [doc] = sessionsProject(r.data);
    expect(doc).toBeDefined();
    expect(r.data.index.projectOrder[doc.project.id]).toBeDefined();
    const tasks = children(doc, null);
    expect(tasks.map((t) => [t.type, t.text])).toEqual([['task', 'Proj · A'], ['task', 'Proj · B']]);
    expect(children(doc, tasks[0].id).map((t) => [t.type, t.text])).toEqual([['task', 'one'], ['task', 'two']]);
    expect(children(doc, tasks[1].id).map((t) => t.text)).toEqual(['beta']);
    expect(r.sessions).toEqual({ A: tasks[0].id, B: tasks[1].id });
  });

  it('adds later replies under the same session Task, after the earlier ones', () => {
    const first = addReplies(emptyData(), [reply('A', 'one')], {}, NOW, ids);
    const second = addReplies(first.data, [reply('A', 'two')], first.sessions, NOW, ids);
    const [doc] = sessionsProject(second.data);
    expect(children(doc, null)).toHaveLength(1);
    expect(children(doc, first.sessions.A).map((t) => t.text)).toEqual(['one', 'two']);
  });

  it('reuses an existing Claude Sessions Project (made on another run or by hand)', () => {
    const data = addProject(emptyData(), { id: 'p_mine', title: SESSIONS_TITLE }, NOW);
    const r = addReplies(data, [reply('A', 'one')], {}, NOW, ids);
    expect(sessionsProject(r.data)).toHaveLength(1);
    expect(Object.keys(r.data.docs.p_mine.items)).toHaveLength(2);
  });

  it('starts a new session Task when the remembered one was crossed out or deleted', () => {
    const first = addReplies(emptyData(), [reply('A', 'one')], {}, NOW, ids);
    const pid = sessionsProject(first.data)[0].project.id;
    const crossed = crossOut(first.data, pid, first.sessions.A, NOW, 'Phone');
    const r = addReplies(crossed, [reply('A', 'two')], first.sessions, NOW, ids);
    expect(r.sessions.A).not.toBe(first.sessions.A);
    expect(children(r.data.docs[pid], r.sessions.A).map((t) => t.text)).toEqual(['two']);
    const gone = addReplies(emptyData(), [reply('A', 'three')], first.sessions, NOW, ids);
    expect(gone.sessions.A).not.toBe(first.sessions.A);
  });

  it('ignores a crossed-out Claude Sessions Project and makes a fresh one', () => {
    const data = addProject(emptyData(), { id: 'p_old', title: SESSIONS_TITLE }, NOW);
    data.docs.p_old.project.crossed = true;
    const r = addReplies(data, [reply('A', 'one')], {}, NOW, ids);
    expect(sessionsProject(r.data).filter((d) => !d.project.crossed)).toHaveLength(1);
  });
});
