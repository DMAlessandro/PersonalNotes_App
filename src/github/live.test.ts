// Against the real api.github.com. Skipped unless LIVE_REPO ("owner/repo"), LIVE_BRANCH and LIVE_TOKEN are set.
// The branch must already exist; the test writes test data to it, so never point it at the branch the app uses.
import { describe, expect, it } from 'vitest';
import { GitHubClient } from './client';
import { pull, push } from '../sync/engine';
import { fromFiles } from '../sync/files';
import { addItem, addProject, editText } from '../domain/edits';
import { crossOut } from '../domain/lifecycle';
import { emptyData } from '../domain/model';

const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const repo = env.LIVE_REPO;
const branch = env.LIVE_BRANCH;
const token = env.LIVE_TOKEN;
const NOW = '2026-10-02T09:00:00.000+02:00';

describe.skipIf(!repo || !branch || !token)('live GitHub', () => {
  const [owner, name] = (repo ?? '/').split('/');
  const cfg = { owner, repo: name, branch: branch!, token: token! };

  it('checks access, pushes atomically, pulls on a second "device", and is rejected then retries', { timeout: 120_000 }, async () => {
    const laptop = new GitHubClient(cfg);
    expect(await laptop.checkAccess()).toMatchObject({ canPush: true, private: true });

    // Laptop: a Project with a non-ASCII title and a crossed Task, pushed in one commit.
    let data = addProject(emptyData(), { id: 'p_live', title: 'Città test ✓' }, NOW);
    data = addItem(data, 'p_live', { id: 'i_1', type: 'task', text: 'First', parent: null }, NOW);
    data = addItem(data, 'p_live', { id: 'i_2', type: 'task', text: 'Second https://example.org', parent: null }, NOW);
    data = crossOut(data, 'p_live', 'i_2', NOW, 'Laptop');
    // First connection of this test "device": the branch holds the empty index, so the pull keeps local data.
    const first = await push(laptop, null, data, 'Laptop');
    expect(first.kind).toBe('pushed');
    if (first.kind !== 'pushed') return;

    // Same head again: the ETag gives a 304.
    expect(await laptop.getHead()).toMatchObject({ status: 'ok' });
    expect(await laptop.getHead()).toMatchObject({ status: 'ok', cached: true });

    // Phone: a fresh device with no data adopts it.
    const phone = new GitHubClient(cfg);
    const p = await pull(phone, null, emptyData());
    expect(p.kind).toBe('adopt');
    if (p.kind !== 'adopt') return;
    expect(p.data).toEqual(data);

    // Phone edits and pushes; the laptop, with no changes of its own, pulls it.
    const phoneData = editText(p.data, 'p_live', 'i_1', 'First (phone)', NOW);
    const pp = await push(phone, p.base, phoneData, 'Phone');
    expect(pp.kind).toBe('pushed');
    laptop.resetEtag();
    const lp = await pull(laptop, first.base, first.data);
    expect(lp.kind === 'adopt' && lp.data.docs.p_live.items.i_1.text).toBe('First (phone)');

    // A stale push never forces: the engine pulls, merges, and stops at the Clash (same Item's text on both).
    const stale = await push(laptop, first.base, editText(first.data, 'p_live', 'i_1', 'laptop edit', NOW), 'Laptop');
    expect(stale.kind).toBe('clashes');

    // What is on the branch reads back exactly.
    if (pp.kind === 'pushed') {
      const again = await pull(new GitHubClient(cfg), null, emptyData());
      expect(again.kind === 'adopt' && again.data).toEqual(fromFiles({}).docs && pp.data);
    }
  });
});
