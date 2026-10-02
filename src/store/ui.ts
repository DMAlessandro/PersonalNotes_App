// Screen state that is never Saved (spec §3.5: e.g. the current Workspace is not remembered).
import { create } from 'zustand';

type Ui = {
  /** Project open in the List view (null = the Project list on a phone). */
  openProject: string | null;
  /** Item or Project whose text is being edited in place: `item:<id>` / `project:<id>`. */
  editing: string | null;
  /** Items added and not yet given text: discarded if left empty. */
  fresh: Set<string>;
  /** Per Project: the Task last chosen in the "Add Subtask" panel, offered again next time. */
  lastSubtaskParent: Record<string, string>;
  setOpenProject: (id: string | null) => void;
  startEditing: (key: string | null, fresh?: string) => void;
  stopEditing: (fresh?: string) => void;
  rememberSubtaskParent: (pid: string, parent: string) => void;
};

export const useUi = create<Ui>((set) => ({
  openProject: null,
  editing: null,
  fresh: new Set(),
  lastSubtaskParent: {},
  setOpenProject: (openProject) => set({ openProject, editing: null }),
  startEditing: (editing, freshId) =>
    set((s) => ({ editing, fresh: freshId ? new Set([...s.fresh, freshId]) : s.fresh })),
  stopEditing: (freshId) =>
    set((s) => {
      const fresh = new Set(s.fresh);
      if (freshId) fresh.delete(freshId);
      return { editing: null, fresh };
    }),
  rememberSubtaskParent: (pid, parent) =>
    set((s) => ({ lastSubtaskParent: { ...s.lastSubtaskParent, [pid]: parent } })),
}));
