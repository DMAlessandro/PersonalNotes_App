import { describe, expect, it } from 'vitest';
import { FakeGit } from '../github/fakeGit';
import { gitBlobSha } from '../github/client';
import { pull, push, type Base } from './engine';
import { fromFiles, stableJson, toFiles } from './files';
import { addItem, addProject, editText, setFolded } from '../domain/edits';
import { emptyData, type AppData } from '../domain/model';

const NOW = '2026-10-02T09:00:00.000+02:00';
const withProject = (title: string, id = `p_${title}`): AppData =>
  addItem(addProject(emptyData(), { id, title }, NOW), id, { id: `i_${title}`, type: 'task', text: `${title} task`, parent: null }, NOW);

describe('gitBlobSha', () => {
  it('matches git for a known file', async () => {
    expect(await gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    expect(await gitBlobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });
});

describe('first Push to an empty repo (spec §5.8)', () => {
  it('sets the repo up, then writes everything in one commit', async () => {
    const git = new FakeGit();
    const local = withProject('Grant');
    const r = await push(git, null, local, 'Laptop');
    expect(r.kind).toBe('pushed');
    expect(Object.keys(git.files()).sort()).toEqual(['data/index.json', 'data/projects/p_Grant.json', 'readable/Grant.md']);
    expect(fromFiles(git.files())).toEqual(local);
    const head = git.commits[git.head!];
    expect(head.message).toBe('Laptop: Grant (2 changes)');
    expect(git.commits[head.parent!].message).toBe('Laptop: set up PersonalNote');
  });
});

describe('Push (spec §6.3)', () => {
  async function setup() {
    const git = new FakeGit();
    const local = withProject('Grant');
    const r = await push(git, null, local, 'Laptop');
    if (r.kind !== 'pushed') throw new Error(r.kind);
    return { git, base: r.base, local };
  }

  it('writes only the files that changed', async () => {
    const { git, base, local } = await setup();
    const both = withProject('Teach');
    const next = { ...local, docs: { ...local.docs, ...both.docs }, index: { ...local.index, projectOrder: { ...local.index.projectOrder, ...both.index.projectOrder } } };
    const before = Object.keys(git.blobs).length;
    const r = await push(git, base, next, 'Laptop');
    expect(r.kind).toBe('pushed');
    expect(Object.keys(git.blobs).length - before).toBe(3); // index, the new Project, its readable copy
  });

  it('says there is nothing to push when nothing changed', async () => {
    const { git, base, local } = await setup();
    expect((await push(git, base, local, 'Laptop')).kind).toBe('nothing');
  });

  it('pushes fold-only changes, labelled as such', async () => {
    const { git, base, local } = await setup();
    const r = await push(git, base, setFolded(local, 'p_Grant', 'i_Grant', true, NOW), 'Laptop');
    expect(r.kind === 'pushed' && r.message).toBe('Laptop: folds (folds only)');
  });

  it('deletes the files of a deleted Project and renames the readable copy with the title', async () => {
    const { git, base, local } = await setup();
    const renamed = { ...local, docs: { p_Grant: { ...local.docs.p_Grant, project: { ...local.docs.p_Grant.project, title: 'Grant v2' } } } };
    const r1 = await push(git, base, renamed, 'Laptop');
    if (r1.kind !== 'pushed') throw new Error(r1.kind);
    expect(Object.keys(git.files())).toContain('readable/Grant v2.md');
    expect(Object.keys(git.files())).not.toContain('readable/Grant.md');
    const gone = { ...renamed, docs: {}, index: { ...renamed.index, projectOrder: {} } };
    await push(git, r1.base, gone, 'Laptop');
    expect(Object.keys(git.files())).toEqual(['data/index.json']);
  });

  it('leaves files the app does not own alone', async () => {
    const { git, base, local } = await setup();
    await git.commitFiles({ 'README.md': '# mine\n' });
    const r = await push(git, base, editText(local, 'p_Grant', 'i_Grant', 'x', NOW), 'Laptop');
    expect(r.kind).toBe('pushed');
    expect(git.files()['README.md']).toBe('# mine\n');
  });

  it('when the other device pushes in between and this one has no conflicting work, retries by itself', async () => {
    const { git, base, local } = await setup();
    // A harmless remote commit (a file the app does not own) lands just before our ref update.
    git.beforeUpdateRef = async () => {
      await git.commitFiles({ 'notes.txt': 'x' });
    };
    const r = await push(git, base, editText(local, 'p_Grant', 'i_Grant', 'edited', NOW), 'Laptop');
    expect(r.kind).toBe('pushed');
    expect(fromFiles(git.files()).docs.p_Grant.items.i_Grant.text).toBe('edited');
    expect(git.files()['notes.txt']).toBe('x');
  });
});

describe('Pull (spec §6.1, one device in slice 4)', () => {
  async function pushed(local: AppData) {
    const git = new FakeGit();
    const r = await push(git, null, local, 'Laptop');
    if (r.kind !== 'pushed') throw new Error(r.kind);
    return { git, base: r.base };
  }

  it('does nothing when the branch has not moved', async () => {
    const local = withProject('Grant');
    const { git, base } = await pushed(local);
    expect((await pull(git, base, local)).kind).toBe('unchanged');
  });

  it('takes the other device\'s changes when this one has none', async () => {
    const local = withProject('Grant');
    const { git, base } = await pushed(local);
    const other = editText(local, 'p_Grant', 'i_Grant', 'from phone', NOW);
    await git.commitFiles({ 'data/projects/p_Grant.json': toFiles(other)['data/projects/p_Grant.json'] });
    const r = await pull(git, base, local);
    expect(r.kind).toBe('adopt');
    if (r.kind === 'adopt') {
      expect(r.data.docs.p_Grant.items.i_Grant.text).toBe('from phone');
      expect(r.base.commit).toBe(git.head);
    }
  });

  it('only downloads files whose content changed', async () => {
    const local = withProject('Grant');
    const two = { ...local, ...withProject('Teach'), docs: { ...local.docs, ...withProject('Teach').docs } };
    const { git, base } = await pushed(two);
    await git.commitFiles({ 'data/projects/p_Grant.json': toFiles(editText(two, 'p_Grant', 'i_Grant', 'x', NOW))['data/projects/p_Grant.json'] });
    git.calls = [];
    await pull(git, base, two);
    expect(git.calls.filter((c) => c === 'getBlob')).toHaveLength(1);
  });

  it('merges when both devices changed different things, and pushes the result', async () => {
    const local = withProject('Grant');
    const { git, base } = await pushed(local);
    const phone = addItem(local, 'p_Grant', { id: 'i_phone', type: 'task', text: 'from phone', parent: null }, NOW);
    await git.commitFiles({ 'data/projects/p_Grant.json': toFiles(phone)['data/projects/p_Grant.json'] });
    const laptop = editText(local, 'p_Grant', 'i_Grant', 'laptop edit', NOW);
    const r = await pull(git, base, laptop);
    expect(r.kind === 'merged' && r.clashes).toEqual([]);
    const p = await push(git, base, laptop, 'Laptop');
    expect(p.kind).toBe('pushed');
    const items = fromFiles(git.files()).docs.p_Grant.items;
    expect(items.i_Grant.text).toBe('laptop edit');
    expect(items.i_phone.text).toBe('from phone');
  });

  it('stops before pushing when the same Item clashes, handing the Clash to the resolver', async () => {
    const local = withProject('Grant');
    const { git, base } = await pushed(local);
    await git.commitFiles({ 'data/projects/p_Grant.json': toFiles(editText(local, 'p_Grant', 'i_Grant', 'phone', NOW))['data/projects/p_Grant.json'] });
    const head = git.head;
    const r = await push(git, base, editText(local, 'p_Grant', 'i_Grant', 'laptop', NOW), 'Laptop');
    expect(r.kind).toBe('clashes');
    if (r.kind === 'clashes') expect(r.clashes[0]).toMatchObject({ id: 'i_Grant', fields: ['text'] });
    expect(git.head).toBe(head); // nothing pushed
  });

  it('when the other device pushes during this Push, pulls, merges and retries by itself', async () => {
    const local = withProject('Grant');
    const { git, base } = await pushed(local);
    git.beforeUpdateRef = async () => {
      const phone = addItem(local, 'p_Grant', { id: 'i_late', type: 'task', text: 'late phone', parent: null }, NOW);
      await git.commitFiles({ 'data/projects/p_Grant.json': toFiles(phone)['data/projects/p_Grant.json'] });
    };
    const r = await push(git, base, editText(local, 'p_Grant', 'i_Grant', 'laptop', NOW), 'Laptop');
    expect(r.kind).toBe('pushed');
    const items = fromFiles(git.files()).docs.p_Grant.items;
    expect(items.i_Grant.text).toBe('laptop');
    expect(items.i_late.text).toBe('late phone');
  });

  it('ignores a remote change that only touched readable/ copies', async () => {
    const local = withProject('Grant');
    const { git, base } = await pushed(local);
    await git.commitFiles({ 'readable/Grant.md': 'hand edit\n' });
    expect((await pull(git, base, editText(local, 'p_Grant', 'i_Grant', 'x', NOW))).kind).toBe('unchanged');
  });
});

describe('first connection of a device (base unknown)', () => {
  it('reports an empty repo', async () => {
    expect((await pull(new FakeGit(), null, emptyData())).kind).toBe('empty');
  });

  it('takes GitHub\'s data when this device has none', async () => {
    const git = new FakeGit();
    await push(git, null, withProject('Grant'), 'Laptop');
    const r = await pull(git, null, emptyData());
    expect(r.kind === 'adopt' && Object.keys(r.data.docs)).toEqual(['p_Grant']);
  });

  it('keeps this device\'s data when GitHub holds none yet', async () => {
    const git = new FakeGit();
    await git.initFile('data/index.json', stableJson(emptyData().index), 'init');
    const r = await pull(git, null, withProject('Phone'));
    expect(r.kind === 'adopt' && Object.keys(r.data.docs)).toEqual(['p_Phone']);
  });

  it('asks when both have data', async () => {
    const git = new FakeGit();
    await push(git, null, withProject('Grant'), 'Laptop');
    const r = await pull(git, null, withProject('Phone'));
    expect(r.kind).toBe('choose');
    expect((await push(git, null, withProject('Phone'), 'Phone')).kind).toBe('choose');
  });

  it('after "Keep both", a Push sends this device\'s Projects too', async () => {
    const { combine } = await import('./engine');
    const git = new FakeGit();
    await push(git, null, withProject('Grant'), 'Laptop');
    const r = await pull(git, null, withProject('Phone'));
    if (r.kind !== 'choose') throw new Error(r.kind);
    const both = combine(withProject('Phone'), r.remote);
    const p = await push(git, r.base as Base, both, 'Phone');
    expect(p.kind).toBe('pushed');
    expect(Object.keys(fromFiles(git.files()).docs).sort()).toEqual(['p_Grant', 'p_Phone']);
  });
});
