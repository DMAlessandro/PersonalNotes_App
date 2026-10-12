import { describe, expect, it } from 'vitest';
import { FakeGit } from '../github/fakeGit';
import { push } from '../sync/engine';
import { fromFiles, toFiles } from '../sync/files';
import { addItem, addProject, editText } from '../domain/edits';
import { children } from '../domain/ordering';
import { emptyData, type AppData } from '../domain/model';
import { deliver, BRIDGE_DEVICE } from './deliver';
import { SESSIONS_TITLE } from './claudeSessions';

const NOW = '2026-10-12T18:00:00.000+02:00';
let n = 0;
const ids = (p: 'p' | 'i') => `${p}_b${++n}`;
const phoneData = (): AppData =>
  addItem(addProject(emptyData(), { id: 'p_grant', title: 'Grant' }, NOW), 'p_grant', { id: 'i_g', type: 'task', text: 'Write aims', parent: null }, NOW);

async function repoWithPhoneData() {
  const git = new FakeGit();
  const r = await push(git, null, phoneData(), 'Phone');
  if (r.kind !== 'pushed') throw new Error(r.kind);
  return git;
}
const sessionsDoc = (d: AppData) => Object.values(d.docs).find((x) => x.project.title === SESSIONS_TITLE)!;

describe('deliver (Claude Sessions bridge → PersonalNotes repo)', () => {
  it('adds the replies in one commit and leaves the other Projects alone', async () => {
    const git = await repoWithPhoneData();
    const r = await deliver(git, null, [{ sid: 'A', title: 'App · A', text: 'hello' }], {}, NOW, ids);
    if (r.kind !== 'pushed') throw new Error(r.kind);
    const repo = fromFiles(git.files());
    expect(repo.docs.p_grant).toEqual(phoneData().docs.p_grant);
    const doc = sessionsDoc(repo);
    expect(children(doc, r.sessions.A).map((t) => t.text)).toEqual(['hello']);
    expect(git.commits[git.head!].message).toMatch(new RegExp(`^${BRIDGE_DEVICE}: `));
  });

  it('works from a stale cached base after the phone pushed', async () => {
    const git = await repoWithPhoneData();
    const first = await deliver(git, null, [{ sid: 'A', title: 'App · A', text: 'one' }], {}, NOW, ids);
    if (first.kind !== 'pushed') throw new Error(first.kind);
    // The phone edits a Task and pushes; the bridge still holds the older base.
    const phone = editText(fromFiles(git.files()), 'p_grant', 'i_g', 'Write aims v2', NOW);
    await git.commitFiles(Object.fromEntries(Object.entries(toFiles(phone)).filter(([p]) => p.startsWith('data/'))));
    const second = await deliver(git, first.base, [{ sid: 'A', title: 'App · A', text: 'two' }], first.sessions, NOW, ids);
    expect(second.kind).toBe('pushed');
    const repo = fromFiles(git.files());
    expect(repo.docs.p_grant.items.i_g.text).toBe('Write aims v2');
    expect(children(sessionsDoc(repo), first.sessions.A).map((t) => t.text)).toEqual(['one', 'two']);
  });

  it('merges when the phone pushes during the delivery', async () => {
    const git = await repoWithPhoneData();
    git.beforeUpdateRef = async () => {
      const phone = editText(fromFiles(git.files()), 'p_grant', 'i_g', 'edited on phone', NOW);
      await git.commitFiles(Object.fromEntries(Object.entries(toFiles(phone)).filter(([p]) => p.startsWith('data/'))));
    };
    const r = await deliver(git, null, [{ sid: 'A', title: 'App · A', text: 'hello' }], {}, NOW, ids);
    if (r.kind !== 'pushed') throw new Error(r.kind);
    const repo = fromFiles(git.files());
    expect(repo.docs.p_grant.items.i_g.text).toBe('edited on phone');
    expect(children(sessionsDoc(repo), r.sessions.A).map((t) => t.text)).toEqual(['hello']);
  });

  it('refuses an empty repo (the app sets it up first)', async () => {
    const r = await deliver(new FakeGit(), null, [{ sid: 'A', title: 'App · A', text: 'x' }], {}, NOW, ids);
    expect(r.kind).toBe('failed');
  });
});
