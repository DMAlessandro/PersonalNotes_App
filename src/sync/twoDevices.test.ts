// Two devices against one repo, step by step, as the user does it (slice 5 scenarios).
import { describe, expect, it } from 'vitest';
import { FakeGit } from '../github/fakeGit';
import { pull, push, type Base } from './engine';
import { countUnpushed } from './changes';
import { addItem, addProject, editText } from '../domain/edits';
import { resolveClash } from '../domain/merge';
import { emptyData, type AppData } from '../domain/model';

const T = (n: number) => `2026-10-02T1${n}:00:00.000+02:00`;
const texts = (d: AppData) => Object.values(d.docs.p.items).map((i) => i.text).sort();

function start(): AppData {
  let d = addProject(emptyData(), { id: 'p', title: 'Grant' }, T(0));
  for (const [id, text] of [['i1', 'Intro'], ['i2', 'Methods'], ['i3', 'Budget']]) {
    d = addItem(d, 'p', { id, type: 'task', text, parent: null }, T(0));
  }
  return d;
}

type Dev = { base: Base | null; data: AppData };

async function doPush(git: FakeGit, dev: Dev, name: string) {
  const r = await push(git, dev.base, dev.data, name);
  if (r.kind === 'pushed' || r.kind === 'nothing') return { dev: { base: r.base, data: r.data }, r };
  if (r.kind === 'clashes') return { dev: { base: r.base, data: r.data }, r };
  throw new Error(r.kind);
}

describe('two devices', () => {
  it('a merged Push counts and pushes only what this device changed', async () => {
    const git = new FakeGit();
    let laptop: Dev = { base: null, data: start() };
    laptop = (await doPush(git, laptop, 'Laptop')).dev;
    const pr = await pull(git, null, emptyData());
    if (pr.kind !== 'adopt') throw new Error(pr.kind);
    let phone: Dev = { base: pr.base, data: pr.data };

    laptop.data = editText(laptop.data, 'p', 'i1', 'Intro (laptop)', T(1));
    phone.data = editText(phone.data, 'p', 'i2', 'Methods (phone)', T(1));
    phone = (await doPush(git, phone, 'Phone')).dev;
    const { dev, r } = await doPush(git, laptop, 'Laptop');
    expect(r.kind === 'pushed' && r.message).toBe('Laptop: Grant (1 change)');
    expect(countUnpushed(dev.base!.data, dev.data)).toBe(0);
    expect(texts(dev.data)).toEqual(['Budget', 'Intro (laptop)', 'Methods (phone)']);
  });

  it('after "Keep both" on the laptop, the phone gets both versions', async () => {
    const git = new FakeGit();
    let laptop: Dev = { base: null, data: start() };
    laptop = (await doPush(git, laptop, 'Laptop')).dev;
    const pr = await pull(git, null, emptyData());
    if (pr.kind !== 'adopt') throw new Error(pr.kind);
    let phone: Dev = { base: pr.base, data: pr.data };

    laptop.data = editText(laptop.data, 'p', 'i3', 'Budget 10k', T(1));
    phone.data = editText(phone.data, 'p', 'i3', 'Budget 12k', T(2));
    phone = (await doPush(git, phone, 'Phone')).dev;

    const c = await doPush(git, laptop, 'Laptop');
    expect(c.r.kind).toBe('clashes');
    if (c.r.kind !== 'clashes') return;
    laptop = { base: c.dev.base, data: resolveClash(c.dev.data, c.r.clashes[0], 'both', T(3)) };
    expect(texts(laptop.data)).toEqual(['Budget 10k', 'Budget 12k', 'Intro', 'Methods']);
    expect(countUnpushed(laptop.base!.data, laptop.data)).toBe(2); // own text + the copy

    laptop = (await doPush(git, laptop, 'Laptop')).dev;
    const pp = await pull(git, phone.base, phone.data);
    expect(pp.kind).toBe('adopt');
    if (pp.kind === 'adopt') expect(texts(pp.data)).toEqual(['Budget 10k', 'Budget 12k', 'Intro', 'Methods']);
  });
});
