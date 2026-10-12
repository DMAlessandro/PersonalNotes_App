// Claude Sessions bridge (ticket 16): one delivery = Pull, add the queued replies, Push (one commit).
// Reuses the app's engine, so a Push from the phone in between is merged like any other device's.
import type { Git } from '../github/client';
import { emptyData, type Timestamp } from '../domain/model';
import { pull, push, type Base } from '../sync/engine';
import { addReplies, type Reply, type SessionMap } from './claudeSessions';

export const BRIDGE_DEVICE = 'Claude bridge';

export type DeliverResult =
  | { kind: 'pushed' | 'nothing'; base: Base; sessions: SessionMap }
  | { kind: 'failed'; reason: string };

export async function deliver(
  git: Git,
  cached: Base | null,
  replies: Reply[],
  sessions: SessionMap,
  now: Timestamp,
  makeId: (prefix: 'p' | 'i') => string,
): Promise<DeliverResult> {
  // Local data = the cached base itself: the bridge never holds edits of its own between runs.
  const pr = await pull(git, cached, cached?.data ?? emptyData());
  if (pr.kind === 'empty') return { kind: 'failed', reason: 'The PersonalNotes repo is empty: set the app up first.' };
  if (pr.kind === 'choose' || pr.kind === 'merged' || !pr.base) return { kind: 'failed', reason: `Unexpected pull result: ${pr.kind}` };
  const base = pr.base;
  const added = addReplies(pr.kind === 'adopt' ? pr.data : base.data, replies, sessions, now, makeId);
  const r = await push(git, base, added.data, BRIDGE_DEVICE);
  if (r.kind === 'pushed' || r.kind === 'nothing') return { kind: r.kind, base: r.base, sessions: added.sessions };
  return { kind: 'failed', reason: r.kind === 'busy' ? 'GitHub kept moving; will retry.' : `Push stopped: ${r.kind}` };
}
