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

const ROOT = dirname(fileURLToPath(import.meta.url));
const QUEUE = join(ROOT, 'queue');
const DATA = join(ROOT, 'data');
const LOCK = join(DATA, 'deliver.lock');
const BASE = join(DATA, 'base.json');
const SESSIONS = join(DATA, 'sessions.json');
const LOG = join(DATA, 'bridge.log');

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
      for (const f of files) unlinkSync(join(QUEUE, f));
      log(`${r.kind}: ${files.length} repl${files.length === 1 ? 'y' : 'ies'} to ${cfg.repo}@${cfg.branch} (${r.base.commit.slice(0, 7)})`);
    }
  } catch (e) {
    log(`error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    if (existsSync(LOCK)) unlinkSync(LOCK);
  }
}

await main();
