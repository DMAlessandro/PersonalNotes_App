// Pull and Push as the user sees them (spec §6): when they run, what the user is told, and where the
// result goes. The decisions themselves are in src/sync/engine.ts and src/domain/merge.ts.
import { create } from 'zustand';
import { GitHubClient, GitHubError } from '../github/client';
import { combine, pull, push, type Base } from '../sync/engine';
import { merge, resolveClash, type Clash } from '../domain/merge';
import type { AppData } from '../domain/model';
import { nowIso } from '../domain/time';
import { loadBase, loadClashes, saveBase, saveClashes } from './db';
import { deviceName } from './device';
import { loadSettings, loadToken } from './settings';
import { useStore } from './store';

/** `settings`: the message offers a button that opens Settings (e.g. to paste a new token). */
export type Notice = { kind: 'info' | 'error'; text: string; at: number; action?: 'settings' };

type Sync = {
  base: Base | null;
  baseLoaded: boolean;
  busy: 'pull' | 'push' | null;
  notice: Notice | null;
  /** First connection, both sides have data: the user chooses (Keep both / Use GitHub's). */
  choice: { remote: AppData; base: Base } | null;
  /** Clashes waiting for the resolver (spec §5.6). Push waits until they are settled. */
  clashes: Clash[];
  resolverOpen: boolean;
  lastPulled: string | null;
  /** Bumped when settings change so the client is rebuilt. */
  configVersion: number;
  init: () => Promise<void>;
  pullNow: (quiet?: boolean) => Promise<void>;
  pushNow: () => Promise<void>;
  resolveChoice: (keep: 'both' | 'github' | null) => Promise<void>;
  settle: (choice: 'this' | 'other' | 'both') => Promise<void>;
  setResolverOpen: (open: boolean) => void;
  /** `repoChanged`: owner/repo/branch changed, so the remembered base belongs to another repo. */
  settingsChanged: (repoChanged: boolean) => Promise<void>;
  dismiss: () => void;
};

export function isConfigured(): boolean {
  const s = loadSettings();
  return !!(s.owner && s.repo && loadToken());
}

let client: { key: string; c: GitHubClient } | null = null;
/** The Pull or Push in progress: a Push pressed meanwhile waits for it instead of being dropped. */
let running: Promise<void> = Promise.resolve();
function gitClient(): GitHubClient {
  const s = loadSettings();
  const token = loadToken() ?? '';
  const key = JSON.stringify([s, token]);
  if (client?.key !== key) client = { key, c: new GitHubClient({ ...s, token }) };
  return client.c;
}

function describe(e: unknown): string {
  if (e instanceof GitHubError) {
    if (e.kind === 'auth') return 'GitHub refused the token: it may have expired or been revoked. Paste a new one in Settings. Your work on this device is safe.';
    if (e.kind === 'offline') return 'No connection to GitHub. Your work is saved on this device.';
    return e.message;
  }
  console.error(e);
  return 'Something went wrong talking to GitHub. Your work is saved on this device.';
}

/** A Clash whose Item (or Project) still exists. */
function stillThere(d: AppData, c: Clash): boolean {
  return c.kind === 'project' ? !!d.docs[c.pid] : !!d.docs[c.pid]?.items[c.id];
}

export const useSync = create<Sync>((set, get) => {
  const note = (kind: Notice['kind'], text: string, action?: Notice['action']) =>
    set({ notice: { kind, text, at: Date.now(), ...(action ? { action } : {}) } });
  const fail = (e: unknown) => note('error', describe(e), e instanceof GitHubError && (e.kind === 'auth' || e.kind === 'forbidden' || e.kind === 'notfound') ? 'settings' : undefined);

  async function setBase(base: Base | null) {
    set({ base });
    await saveBase(base);
  }

  async function setClashes(clashes: Clash[]) {
    set({ clashes, resolverOpen: clashes.length > 0 && (get().resolverOpen || clashes.length > get().clashes.length) });
    await saveClashes(clashes);
  }

  /**
   * Put data from GitHub (adopted or merged) on screen. If the user edited while the network call ran,
   * their new edits are merged on top, so nothing typed meanwhile is lost.
   */
  function land(snapshot: AppData, incoming: AppData) {
    const current = useStore.getState().data;
    const next = current === snapshot ? incoming : merge(snapshot, current, incoming).result;
    useStore.getState().apply(() => next);
  }

  async function addClashes(found: Clash[]) {
    if (!found.length) return;
    const rest = get().clashes.filter((c) => !found.some((f) => f.id === c.id));
    await setClashes([...rest, ...found]);
  }

  const clashNote = (n: number) =>
    `${n === 1 ? 'One Item was' : `${n} Items were`} changed differently on both devices. Choose which version to keep.`;

  return {
    base: null,
    baseLoaded: false,
    busy: null,
    notice: null,
    choice: null,
    clashes: [],
    resolverOpen: false,
    lastPulled: null,
    configVersion: 0,

    init: async () => {
      const [base, clashes] = await Promise.all([loadBase(), loadClashes()]);
      set({ base, clashes, baseLoaded: true, resolverOpen: clashes.length > 0 });
    },

    pullNow: async (quiet = false) => {
      if (!isConfigured() || get().busy || !get().baseLoaded || !useStore.getState().loaded) return;
      set({ busy: 'pull' });
      let done!: () => void;
      running = new Promise((r) => (done = r));
      const snapshot = useStore.getState().data;
      try {
        const r = await pull(gitClient(), get().base, snapshot);
        set({ lastPulled: nowIso() });
        if (r.kind === 'unchanged') {
          if (r.base !== get().base) await setBase(r.base);
          if (!quiet) note('info', 'Up to date.');
        } else if (r.kind === 'adopt') {
          land(snapshot, r.data);
          await setBase(r.base);
          if (!quiet) note('info', 'Pulled the latest from GitHub.');
        } else if (r.kind === 'merged') {
          land(snapshot, r.data);
          await setBase(r.base);
          await addClashes(r.clashes);
          if (r.clashes.length) note('info', clashNote(r.clashes.length));
          else if (!quiet) note('info', "Pulled the other device's changes and combined them with yours.");
        } else if (r.kind === 'empty') {
          if (!quiet) note('info', 'The GitHub repo is empty. Press Push to send your Projects.');
        } else {
          set({ choice: { remote: r.remote, base: r.base } });
        }
      } catch (e) {
        if (!quiet || !(e instanceof GitHubError && e.kind === 'offline')) fail(e);
      } finally {
        set({ busy: null });
        done();
      }
    },

    pushNow: async () => {
      if (!isConfigured() || get().busy === 'push') return;
      if (get().busy === 'pull') await running; // e.g. the automatic Pull on returning to the app
      if (get().busy) return;
      if (get().clashes.length) {
        set({ resolverOpen: true });
        return;
      }
      set({ busy: 'push' });
      const snapshot = useStore.getState().data;
      try {
        const r = await push(gitClient(), get().base, snapshot, deviceName());
        if (r.kind === 'pushed') {
          if (r.data !== snapshot) land(snapshot, r.data); // the push included a merge
          await setBase(r.base);
          set({ lastPulled: nowIso() });
          note('info', `Pushed: ${r.message}`);
        } else if (r.kind === 'nothing') {
          if (r.data !== snapshot) land(snapshot, r.data);
          await setBase(r.base);
          note('info', 'Nothing to push: GitHub already has everything.');
        } else if (r.kind === 'clashes') {
          land(snapshot, r.data);
          await setBase(r.base);
          await addClashes(r.clashes);
          note('info', clashNote(r.clashes.length) + ' Then press Push again.');
        } else if (r.kind === 'choose') {
          set({ choice: { remote: r.remote, base: r.base } });
        } else {
          note('error', "Couldn't Push: the other device kept pushing at the same time. Try again.");
        }
      } catch (e) {
        fail(e);
      } finally {
        set({ busy: null });
      }
    },

    resolveChoice: async (keep) => {
      const c = get().choice;
      set({ choice: null });
      if (!c || !keep) return;
      const local = useStore.getState().data;
      useStore.getState().apply(() => (keep === 'both' ? combine(local, c.remote) : c.remote));
      await setBase(c.base);
      note('info', keep === 'both' ? "Combined. Press Push to send this device's Projects to GitHub." : "This device now has GitHub's Projects.");
    },

    settle: async (choice) => {
      const [first, ...rest] = get().clashes;
      if (!first) return;
      if (stillThere(useStore.getState().data, first)) {
        useStore.getState().apply((d, now) => resolveClash(d, first, choice, now));
      }
      const left = rest.filter((c) => stillThere(useStore.getState().data, c));
      set({ resolverOpen: left.length > 0 });
      await setClashes(left);
      if (!left.length) note('info', 'All settled. Press Push to send the result.');
    },

    setResolverOpen: (resolverOpen) => set({ resolverOpen }),

    settingsChanged: async (repoChanged) => {
      client = null;
      set((s) => ({ configVersion: s.configVersion + 1 }));
      if (repoChanged) {
        await setBase(null);
        await setClashes([]);
      }
    },

    dismiss: () => set({ notice: null }),
  };
});
