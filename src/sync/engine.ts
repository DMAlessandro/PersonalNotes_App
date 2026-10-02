// Spec §6.1 Pull and §6.3 Push. When both devices changed things since the last Pull, the three-way
// merge (src/domain/merge.ts) combines them; Clashes go to the resolver before anything is pushed.
import { gitBlobSha, type Git } from '../github/client';
import { emptyData, type AppData } from '../domain/model';
import { changedFiles, fromFiles, isDataPath, isEmptyData, stableJson, toFiles, type Files } from './files';
import { commitMessage } from './changes';
import { merge, type Clash } from '../domain/merge';
import { canonical } from '../domain/canonical';

/** The last commit this device pulled or pushed: the "base" of the three-way merge (spec §3.5). */
export type Base = {
  commit: string;
  tree: string;
  /** Blob id of every file in that commit (data/, readable/ and anything else). */
  blobs: Record<string, string>;
  /** That commit's data, parsed. */
  data: AppData;
};

export type PullResult =
  | { kind: 'unchanged'; base: Base | null }
  | { kind: 'adopt'; data: AppData; base: Base }
  | { kind: 'empty' }
  | { kind: 'choose'; remote: AppData; base: Base }
  | { kind: 'merged'; data: AppData; base: Base; clashes: Clash[] };

const owned = (p: string) => p.startsWith('data/') || p.startsWith('readable/');

/** Data files only, for "did the data change?" comparisons. */
function dataFiles(d: AppData): Files {
  return Object.fromEntries(Object.entries(toFiles(d)).filter(([p]) => isDataPath(p)));
}

const sameData = (a: AppData, b: AppData) => canonical(dataFiles(a)) === canonical(dataFiles(b));

/** Union of two sets of data that share nothing yet (first connection, "Keep both"). */
export function combine(local: AppData, remote: AppData): AppData {
  const workspaces = { ...remote.index.workspaces };
  for (const [id, w] of Object.entries(local.index.workspaces)) {
    const r = workspaces[id];
    workspaces[id] = r ? { ...w, projects: [...new Set([...r.projects, ...w.projects])] } : w;
  }
  return {
    index: {
      schema: 1,
      projectOrder: { ...remote.index.projectOrder, ...local.index.projectOrder },
      workspaces,
    },
    docs: { ...remote.docs, ...local.docs },
    log: { ...remote.log, ...local.log },
  };
}

async function readCommit(git: Git, commit: string, base: Base | null): Promise<Base> {
  const tree = await git.getCommitTree(commit);
  const entries = await git.getTree(tree);
  const known = base ? toFiles(base.data) : {};
  const files: Files = {};
  for (const e of entries) {
    if (!isDataPath(e.path)) continue;
    const mine = known[e.path];
    // Unchanged files are rebuilt from the base instead of downloaded; anything else is fetched.
    files[e.path] = mine !== undefined && (await gitBlobSha(mine)) === e.sha ? mine : await git.getBlob(e.sha);
  }
  return { commit, tree, blobs: Object.fromEntries(entries.map((e) => [e.path, e.sha])), data: fromFiles(files) };
}

export async function pull(git: Git, base: Base | null, local: AppData): Promise<PullResult> {
  const head = await git.getHead();
  if (head.status === 'empty') return { kind: 'empty' };
  if (head.sha === base?.commit) return { kind: 'unchanged', base };

  const remote = await readCommit(git, head.sha, base);

  if (!base) {
    // First connection of this device.
    if (isEmptyData(remote.data)) return { kind: 'adopt', data: combine(local, remote.data), base: remote };
    if (isEmptyData(local)) return { kind: 'adopt', data: remote.data, base: remote };
    return { kind: 'choose', remote: remote.data, base: remote };
  }
  if (sameData(remote.data, base.data)) return { kind: 'unchanged', base: remote }; // e.g. only readable/ moved
  if (sameData(local, base.data)) return { kind: 'adopt', data: remote.data, base: remote };
  const m = merge(base.data, local, remote.data);
  return { kind: 'merged', data: m.result, base: remote, clashes: m.clashes };
}

export type PushResult =
  | { kind: 'pushed'; base: Base; data: AppData; message: string }
  | { kind: 'nothing'; base: Base; data: AppData }
  | { kind: 'choose'; remote: AppData; base: Base }
  | { kind: 'clashes'; data: AppData; base: Base; clashes: Clash[] }
  | { kind: 'busy' };

const RETRIES = 3;

/** Pull, then one atomic commit with everything that differs from the base (spec §6.3). */
export async function push(git: Git, startBase: Base | null, startLocal: AppData, device: string): Promise<PushResult> {
  let base = startBase;
  let local = startLocal;

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const pr = await pull(git, base, local);
    if (pr.kind === 'choose') return pr;
    if (pr.kind === 'merged') {
      // Clashes are settled by the user first (spec §5.6); everything else merged silently and goes up now.
      if (pr.clashes.length) return { kind: 'clashes', data: pr.data, base: pr.base, clashes: pr.clashes };
      base = pr.base;
      local = pr.data;
    } else if (pr.kind === 'adopt') {
      base = pr.base;
      local = pr.data;
    } else if (pr.kind === 'unchanged') {
      base = pr.base;
    } else {
      // Empty repo: the first file goes in with the Contents API (spec §5.8 step 5).
      const content = stableJson(local.index);
      const init = await git.initFile('data/index.json', content, `${device}: set up PersonalNote`);
      base = {
        commit: init.commit,
        tree: init.tree,
        blobs: { 'data/index.json': await gitBlobSha(content) },
        data: { ...emptyData(), index: local.index },
      };
    }
    if (!base) throw new Error('No base after pull');

    const next = toFiles(local);
    const writes: Record<string, string | null> = {};
    for (const [path, content] of Object.entries(changedFiles({}, next))) {
      if (content !== null && base.blobs[path] !== (await gitBlobSha(content))) writes[path] = content;
    }
    for (const path of Object.keys(base.blobs)) if (owned(path) && !(path in next)) writes[path] = null;
    if (!Object.keys(writes).length) return { kind: 'nothing', base, data: local };

    const message = commitMessage(device, base.data, local);
    const tree = await git.createTree(base.tree, writes);
    const commit = await git.createCommit(message, tree, base.commit);
    if ((await git.updateRef(commit)) === 'rejected') continue; // the other device pushed: pull again

    const blobs = { ...base.blobs };
    for (const [path, content] of Object.entries(writes)) {
      if (content === null) delete blobs[path];
      else blobs[path] = await gitBlobSha(content);
    }
    return { kind: 'pushed', base: { commit, tree, blobs, data: local }, data: local, message };
  }
  return { kind: 'busy' };
}
