// App state (Zustand) over the pure domain edits. Every change is Saved to IndexedDB at once (spec §1).
import { create } from 'zustand';
import { emptyData, type AppData } from '../domain/model';
import { nowIso } from '../domain/time';
import { loadData, saveChanges } from './db';

type State = {
  data: AppData;
  loaded: boolean;
  saveError: string | null;
  load: () => Promise<void>;
  /** Apply a domain edit. `fn` gets the current time so every stamp in one edit matches. */
  apply: (fn: (data: AppData, now: string) => AppData) => void;
};

// Saves run one after another, in edit order.
let saving: Promise<void> = Promise.resolve();

export const useStore = create<State>((set, get) => ({
  data: emptyData(),
  loaded: false,
  saveError: null,
  load: async () => {
    set({ data: await loadData(), loaded: true });
  },
  apply: (fn) => {
    const prev = get().data;
    let next: AppData;
    try {
      next = fn(prev, nowIso());
    } catch (e) {
      console.warn('Edit refused:', e);
      return;
    }
    if (next === prev) return;
    set({ data: next });
    saving = saving
      .then(() => saveChanges(prev, next))
      .then(() => {
        if (get().saveError) set({ saveError: null });
      })
      .catch((e) => {
        console.error(e);
        set({ saveError: 'Could not save on this device. Your last change may be lost if you close the app.' });
      });
  },
}));
