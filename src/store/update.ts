// App updates. The installed app keeps a copy of itself so it opens offline; a new version is
// downloaded in the background and used only after a reload. Instead of reloading on its own (which
// could interrupt typing), the app shows "A new version is ready — Reload" (spec §8 slice 9, built early).
import { create } from 'zustand';

type Update = {
  ready: boolean;
  /** Set by main.tsx once the service worker is registered. */
  apply: () => void;
};

export const useUpdate = create<Update>(() => ({ ready: false, apply: () => window.location.reload() }));
