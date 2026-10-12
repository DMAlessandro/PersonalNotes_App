// Claude Sessions bridge, delivery process (ticket 16). Started in the background by hook.mjs after a
// flagged reply is queued; also safe to run by hand (`node deliver.mjs`) to retry. Bundled to deliver.mjs
// by scripts/build-bridge.mjs and run from the folder that holds config.json, queue/ and data/.
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitHubClient, type RepoConfig } from '../src/github/client';
import { newId } from '../src/domain/ids';
import { nowIso } from '../src/domain/time';
import type { Base } from '../src/sync/engine';
import { deliver } from '../src/bridge/deliver';
import type { Reply, SessionMap } from '../src/bridge/claudeSessions';
import { answerMessage, findAnswers } from '../src/bridge/answers';
import type { ProjectDoc } from '../src/domain/model';

const ROOT = dirname(fileURLToPath(import.meta.url));
const QUEUE = join(ROOT, 'queue');
const DATA = join(ROOT, 'data');
const LOCK = join(DATA, 'deliver.lock');
const BASE = join(DATA, 'base.json');
const SESSIONS = join(DATA, 'sessions.json');
const LOG = join(DATA, 'bridge.log');
const PROJECT = join(DATA, 'project.json');

const log = (line: string) => appendFileSync(LOG, `${new Date().toISOString()} deliver ${line}\n`);
const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback);

/** One delivery at a time; a lock older than 3 minutes is left over from a crash. */
function takeLock(): boolean {
  try {
    closeSync(openSync(LOCK, 'wx'));
    return true;
  } catch {
    if (Date.now() - statSync(LOCK).mtimeMs < 3 * 60_000) return false;
    unlinkSync(LOCK);
    return takeLock();
  }
}

function config(): RepoConfig {
  const c = readJson<Partial<RepoConfig>>(join(ROOT, 'config.json'), {});
  const cfg = {
    owner: process.env.BRIDGE_OWNER ?? c.owner ?? '',
    repo: process.env.BRIDGE_REPO ?? c.repo ?? '',
    branch: process.env.BRIDGE_BRANCH ?? c.branch ?? 'main',
    token: process.env.BRIDGE_TOKEN ?? c.token ?? '',
  };
  if (!cfg.owner || !cfg.repo || !cfg.token) throw new Error('config.json needs owner, repo and token');
  return cfg;
}

// Node's fetch has no HTTP cache, and the browser-only `cache` option is dropped.
const nodeFetch: typeof fetch = (input, init) => {
  const { cache: _cache, ...rest } = init ?? {};
  return fetch(input, rest);
};

async function main() {
  mkdirSync(DATA, { recursive: true });
  mkdirSync(QUEUE, { recursive: true });
  if (!takeLock()) return log('another delivery is running; it will pick these up');
  try {
    const cfg = config();
    const git = new GitHubClient(cfg, nodeFetch);
    // Replies queued while a delivery runs are picked up by the next round.
    for (let round = 0; round < 5; round++) {
      const files = readdirSync(QUEUE).filter((f) => f.endsWith('.json')).sort();
      if (!files.length) return;
      const replies = files.map((f) => JSON.parse(readFileSync(join(QUEUE, f), 'utf8')) as Reply);
      const cached = readJson<Base | null>(BASE, null);
      const cachedForBranch = cached && readJson<{ branch?: string }>(join(DATA, 'base.branch.json'), {}).branch === cfg.branch ? cached : null;
      const r = await deliver(git, cachedForBranch, replies, readJson<SessionMap>(SESSIONS, {}), nowIso(), newId);
      if (r.kind === 'failed') return log(`failed: ${r.reason} (${files.length} left in queue)`);
      writeFileSync(BASE, JSON.stringify(r.base));
      writeFileSync(join(DATA, 'base.branch.json'), JSON.stringify({ branch: cfg.branch }));
      writeFileSync(SESSIONS, JSON.stringify(r.sessions, null, 2));
      if (r.pid) writeFileSync(PROJECT, JSON.stringify({ pid: r.pid }));
      for (const f of files) unlinkSync(join(QUEUE, f));
      log(`${r.kind}: ${files.length} repl${files.length === 1 ? 'y' : 'ies'} to ${cfg.repo}@${cfg.branch} (${r.base.commit.slice(0, 7)})`);
    }
  } catch (e) {
    log(`error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    if (existsSync(LOCK)) unlinkSync(LOCK);
  }
}

// ---- Phase 3: wait for an answer from the phone -----------------------------------------------------------
// Runs as an `asyncRewake` Stop hook (`node deliver.mjs --wait`, hook input on stdin): in the background,
// after a reply of a #phoneon session. When a Note appears under that session's Task in the repo, it prints
// the answer on stderr and exits 2, which wakes the session with it. It gives up quietly (exit 0) when the
// session is switched off, the user types at the laptop, a newer reply starts a newer waiter, or time runs out.

const POLL_MS = 15_000;
const STATE = join(DATA, 'state');
const ANSWERED = join(DATA, 'answered.json');

async function readProjectDoc(git: GitHubClient, commit: string, pid: string): Promise<ProjectDoc | null> {
  const entries = await git.getTree(await git.getCommitTree(commit));
  const entry = entries.find((e) => e.path === `data/projects/${pid}.json`);
  return entry ? (JSON.parse(await git.getBlob(entry.sha)) as ProjectDoc) : null;
}

async function wait(): Promise<number> {
  const input = JSON.parse(readFileSync(0, 'utf8')) as { session_id?: string };
  const sid = String(input.session_id ?? '');
  const statePath = join(STATE, `${sid}.json`);
  type State = { mode?: string; waiter?: string; promptAt?: number; title?: string };
  const readState = () => readJson<State>(statePath, {});
  if (!sid || readState().mode !== 'on') return 0;

  const me = `${process.pid}-${Date.now()}`;
  const started = Date.now();
  writeFileSync(statePath, JSON.stringify({ ...readState(), waiter: me }));
  const cfg = config();
  const minutes = Number(readJson<{ waitMinutes?: number }>(join(ROOT, 'config.json'), {}).waitMinutes ?? 55);
  const git = new GitHubClient(cfg, nodeFetch);
  log(`wait ${sid.slice(0, 8)}: up to ${minutes} min`);
  let seen = '';

  while (Date.now() - started < minutes * 60_000) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const st = readState();
    if (st.mode !== 'on' || st.waiter !== me || (st.promptAt ?? 0) > started) {
      log(`wait ${sid.slice(0, 8)}: stopped (${st.mode !== 'on' ? 'switched off' : st.waiter !== me ? 'newer reply' : 'typed at the laptop'})`);
      return 0;
    }
    const taskId = readJson<SessionMap>(SESSIONS, {})[sid];
    const pid = readJson<{ pid?: string }>(PROJECT, {}).pid;
    if (!taskId || !pid) continue; // the reply is still on its way to GitHub
    try {
      const head = await git.getHead();
      if (head.status !== 'ok' || head.sha === seen) continue;
      seen = head.sha;
      const doc = await readProjectDoc(git, head.sha, pid);
      if (!doc) continue;
      const answered = readJson<string[]>(ANSWERED, []);
      const found = findAnswers(doc, taskId, answered);
      if (!found.length) continue;
      writeFileSync(ANSWERED, JSON.stringify([...answered, ...found.map((f) => f.id)]));
      const msg = answerMessage(found.map((f) => f.text));
      if (msg.off) writeFileSync(statePath, JSON.stringify({ ...readState(), mode: 'off' }));
      log(`wait ${sid.slice(0, 8)}: answer found (${found.length} Note${found.length === 1 ? '' : 's'}${msg.off ? ', #phoneoff' : ''})`);
      if (!msg.text) return 0;
      process.stderr.write(
        `The user answered from their phone (Claude Sessions bridge). Treat this as their next message:\n\n${msg.text}\n`,
      );
      return 2;
    } catch (e) {
      log(`wait ${sid.slice(0, 8)}: ${e instanceof Error ? e.message : String(e)} (still waiting)`);
    }
  }
  log(`wait ${sid.slice(0, 8)}: no answer after ${minutes} min`);
  return 0;
}

if (process.argv.includes('--wait')) {
  mkdirSync(DATA, { recursive: true });
  let code = 0;
  try {
    code = await wait();
  } catch (e) {
    log(`wait error: ${e instanceof Error ? e.message : String(e)}`);
  }
  process.exit(code);
} else {
  await main();
}
