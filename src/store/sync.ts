// Pull and Push as the user sees them (spec §6): when they run, what the user is told, and where the
// result goes. The decisions themselves are in src/sync/engine.ts.
import { create } from 'zustand';
import { GitHubClient, GitHubError } from '../github/client';
import { combine, pull, push, type Base } from '../sync/engine';
import type { AppData } from '../domain/model';
import { nowIso } from '../domain/time';
import { loadBase, saveBase } from './db';
import { deviceName } from './device';
import { loadSettings, loadToken } from './settings';
import { useStore } from './store';

export type Notice = { kind: 'info' | 'error'; text: string; at: number };

type Sync = {
  base: Base | null;
  baseLoaded: boolean;
  busy: 'pull' | 'push' | null;
  notice: Notice | null;
  /** First connection, both sides have data: the user chooses (Keep both / Use GitHub's). */
  choice: { remote: AppData; base: Base } | null;
  /** The other device pushed while this one has unpushed edits: merging comes in slice 5. */
  blocked: boolean;
  lastPulled: string | null;
  /** Bumped when settings change so the client is rebuilt. */
  configVersion: number;
  init: () => Promise<void>;
  pullNow: (quiet?: boolean) => Promise<void>;
  pushNow: () => Promise<void>;
  resolveChoice: (keep: 'both' | 'github' | null) => Promise<void>;
  /** `repoChanged`: owner/repo/branch changed, so the remembered base belongs to another repo. */
  settingsChanged: (repoChanged: boolean) => Promise<void>;
  dismiss: () => void;
};

export function isConfigured(): boolean {
  const s = loadSettings();
  return !!(s.owner && s.repo && loadToken());
}

let client: { key: string; c: GitHubClient } | null = null;
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

const BLOCKED =
  'The other device has pushed changes, and this one has changes too. Merging arrives in the next build step: for now nothing was pulled or pushed, and your edits here are kept.';

export const useSync = create<Sync>((set, get) => {
  const note = (kind: Notice['kind'], text: string) => set({ notice: { kind, text, at: Date.now() } });

  async function setBase(base: Base | null) {
    set({ base });
    await saveBase(base);
  }

  /** Replace the data with what came from GitHub, unless the user edited meanwhile (then keep theirs). */
  function adopt(snapshot: AppData, data: AppData) {
    if (useStore.getState().data === snapshot) useStore.getState().apply(() => data);
  }

  return {
    base: null,
    baseLoaded: false,
    busy: null,
    notice: null,
    choice: null,
    blocked: false,
    lastPulled: null,
    configVersion: 0,

    init: async () => {
      set({ base: await loadBase(), baseLoaded: true });
    },

    pullNow: async (quiet = false) => {
      if (!isConfigured() || get().busy || !get().baseLoaded || !useStore.getState().loaded) return;
      set({ busy: 'pull' });
      const snapshot = useStore.getState().data;
      try {
        const r = await pull(gitClient(), get().base, snapshot);
        set({ lastPulled: nowIso(), blocked: r.kind === 'blocked' });
        if (r.kind === 'unchanged') {
          if (r.base !== get().base) await setBase(r.base);
          if (!quiet) note('info', 'Up to date.');
        } else if (r.kind === 'adopt') {
          adopt(snapshot, r.data);
          await setBase(r.base);
          if (!quiet) note('info', 'Pulled the latest from GitHub.');
        } else if (r.kind === 'empty') {
          if (!quiet) note('info', 'The GitHub repo is empty. Press Push to send your Projects.');
        } else if (r.kind === 'choose') {
          set({ choice: { remote: r.remote, base: r.base } });
        } else {
          note('error', BLOCKED);
        }
      } catch (e) {
        if (!quiet || !(e instanceof GitHubError && e.kind === 'offline')) note('error', describe(e));
      } finally {
        set({ busy: null });
      }
    },

    pushNow: async () => {
      if (!isConfigured() || get().busy) return;
      set({ busy: 'push' });
      const snapshot = useStore.getState().data;
      try {
        const r = await push(gitClient(), get().base, snapshot, deviceName());
        if (r.kind === 'pushed') {
          await setBase(r.base);
          set({ blocked: false, lastPulled: nowIso() });
          note('info', `Pushed: ${r.message}`);
        } else if (r.kind === 'nothing') {
          adopt(snapshot, r.data);
          await setBase(r.base);
          set({ blocked: false });
          note('info', 'Nothing to push: GitHub already has everything.');
        } else if (r.kind === 'choose') {
          set({ choice: { remote: r.remote, base: r.base } });
        } else if (r.kind === 'blocked') {
          set({ blocked: true });
          note('error', BLOCKED);
        } else {
          note('error', "Couldn't Push: the other device kept pushing at the same time. Try again.");
        }
      } catch (e) {
        note('error', describe(e));
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
      note('info', keep === 'both' ? 'Combined. Press Push to send this device\'s Projects to GitHub.' : 'This device now has GitHub\'s Projects.');
    },

    settingsChanged: async (repoChanged) => {
      client = null;
      set((s) => ({ configVersion: s.configVersion + 1, blocked: false }));
      if (repoChanged) await setBase(null);
    },

    dismiss: () => set({ notice: null }),
  };
});
