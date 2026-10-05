// Laptop shortcuts for adding (ticket 13), shared by the List view and the Map view:
// double-click empty space = new Task; Ctrl+Enter = a same-type sibling directly below the edited or
// selected Item, or a new top-level Task when nothing is selected; Esc clears the selection.
import { useEffect } from 'react';
import { addItem, setProjectFolded } from '../domain/edits';
import { newId } from '../domain/ids';
import { shownProjectIds } from '../domain/workspaces';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';

function editNew(pid: string, id: string) {
  if (!useStore.getState().data.docs[pid]?.items[id]) return; // the edit was refused
  const ui = useUi.getState();
  ui.setSelected({ pid, id });
  ui.startEditing(`item:${id}`, id);
}

/** A new, empty top-level Task at the end of the Project, ready to type into. */
export function addTopTask(pid: string) {
  if (!useStore.getState().data.docs[pid]) return;
  const id = newId('i');
  useStore.getState().apply((d, now) =>
    addItem(d.docs[pid].project.folded ? setProjectFolded(d, pid, false, now) : d, pid, { id, type: 'task', text: '', parent: null }, now),
  );
  editNew(pid, id);
}

/** A new, empty Item of the same type directly below `id`, at the same level, ready to type into. */
export function addSiblingBelow(pid: string, id: string) {
  const it = useStore.getState().data.docs[pid]?.items[id];
  if (!it) return;
  const nid = newId('i');
  useStore.getState().apply((d, now) => addItem(d, pid, { id: nid, type: it.type, text: '', parent: it.parent, after: id }, now));
  editNew(pid, nid);
}

/** Where a Task goes when nothing is selected: the open Project (List), else the last one used if it is shown. */
export function targetProject(listProject: string | null): string | null {
  if (listProject) return listProject;
  const { lastProject, workspace } = useUi.getState();
  const shown = shownProjectIds(useStore.getState().data, workspace);
  return lastProject && shown.includes(lastProject) ? lastProject : (shown[0] ?? null);
}

/** Mouse only: a click selects an Item (the touch screen has no selection). */
export function selectOnMouse(pid: string, id: string) {
  return (e: { pointerType: string; target: EventTarget }) => {
    if (e.pointerType !== 'mouse') return;
    if ((e.target as HTMLElement).closest('button, input, textarea, a, select')) return;
    useUi.getState().setSelected({ pid, id });
  };
}

/** Whether the last pointer was a mouse, so a double-click on empty space only adds a Task on the laptop. */
let lastPointer = 'mouse';
export const lastPointerWasMouse = () => lastPointer === 'mouse';

/**
 * App-wide keys and clicks. `listProject`: the Project open in the List view (null on the Map or the list).
 * `blocked`: an overlay (Change log, Settings, Search, Workspaces, resolver) is open, so the keys do nothing.
 */
export function useLaptopShortcuts(listProject: string | null, blocked: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blocked || document.querySelector('[role=dialog]')) return;
      // While text is being edited, the editor handles its own keys (TextEditor: Ctrl+Enter, Enter, Esc).
      if ((e.target as HTMLElement).closest?.('textarea, input, select, [contenteditable]')) return;
      const ui = useUi.getState();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const sel = ui.selected;
        if (sel && useStore.getState().data.docs[sel.pid]?.items[sel.id]) addSiblingBelow(sel.pid, sel.id);
        else {
          const pid = targetProject(listProject);
          if (pid) addTopTask(pid);
        }
      } else if (e.key === 'Escape' && ui.selected) ui.setSelected(null);
    };
    // A click on empty space (not on an Item, a menu or a panel) clears the selection.
    const onDown = (e: PointerEvent) => {
      lastPointer = e.pointerType;
      if (e.pointerType !== 'mouse' || !useUi.getState().selected) return;
      if (!(e.target as HTMLElement).closest('[data-select], [role=dialog], [role=menu]')) useUi.getState().setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [listProject, blocked]);
}
