// The edits a user starts from an Item or a Project: shared by the List view (cards) and the Map view,
// so both offer the same menu (spec §5.2, §5.3) and edit text the same way.
import { useState } from 'react';
import type { Item, ProjectDoc } from '../domain/model';
import { children } from '../domain/ordering';
import {
  addItem, canIndent, canMoveToProject, canOutdent, discardItem, discardProject, editText, indent, makeTask, moveToProject, outdent,
  renameProject, setFolded,
} from '../domain/edits';
import { crossOut, crossProject, deleteItem, deleteProject, sendProjectToBottom, sendToBottom, uncross, uncrossProject } from '../domain/lifecycle';
import { shownProjectIds } from '../domain/workspaces';
import { newId } from '../domain/ids';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { deviceName } from '../store/device';
import { Menu, Panel, type MenuEntry } from './Panel';
import { DueSheet } from './DueSheet';
import { Confirm } from './Confirm';
import { ProjectWorkspaces } from './Workspaces';

export function countDescendants(doc: ProjectDoc, id: string): number {
  return children(doc, id).reduce((n, c) => n + 1 + countDescendants(doc, c.id), 0);
}

/** In-place text editing of an Item. A new Item left empty is discarded (not a Delete). */
export function useItemEditing(pid: string, item: Item) {
  const apply = useStore((s) => s.apply);
  const { editing, fresh, startEditing, stopEditing } = useUi();
  const isEditing = editing === `item:${item.id}`;

  const finishEdit = (text: string) => {
    const isFresh = fresh.has(item.id);
    stopEditing(item.id);
    if (!text.trim()) {
      if (isFresh) apply((d) => discardItem(d, pid, item.id));
      return;
    }
    if (text !== item.text) apply((d, now) => editText(d, pid, item.id, text, now));
  };

  const cancelEdit = () => {
    const isFresh = fresh.has(item.id);
    stopEditing(item.id);
    if (isFresh && !item.text) apply((d) => discardItem(d, pid, item.id));
  };

  /** Laptop: Tab / Shift+Tab while editing indents / outdents (spec §4.4). */
  const tabEdit = (text: string, shift: boolean) => {
    finishEdit(text);
    if (!text.trim()) return;
    apply((d, now) => {
      const cur = d.docs[pid];
      if (shift) return canOutdent(cur, item.id) ? outdent(d, pid, item.id, now) : d;
      return canIndent(cur, item.id) ? indent(d, pid, item.id, now) : d;
    });
    startEditing(`item:${item.id}`);
  };

  return { isEditing, startEdit: () => startEditing(`item:${item.id}`), finishEdit, cancelEdit, tabEdit };
}

/** The ⋯ menu of an Item and the panels it opens (due date, Move to Project, Delete confirmation). */
export function useItemMenu(doc: ProjectDoc, item: Item) {
  const pid = doc.project.id;
  const apply = useStore((s) => s.apply);
  const startEditing = useUi((s) => s.startEditing);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [dueOpen, setDueOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moving, setMoving] = useState(false);
  const isTask = item.type === 'task';
  const under = countDescendants(doc, item.id);

  const addUnder = (type: 'task' | 'note') => {
    const id = newId('i');
    apply((d, now) => {
      const opened = d.docs[pid].items[item.id]?.folded ? setFolded(d, pid, item.id, false, now) : d;
      return addItem(opened, pid, { id, type, text: '', parent: item.id }, now);
    });
    startEditing(`item:${id}`, id);
  };

  const toggleCross = () =>
    apply((d, now) => (item.crossed ? uncross(d, pid, item.id, now) : crossOut(d, pid, item.id, now, deviceName())));

  const entries: MenuEntry[] = [
    isTask && { label: 'Add Task under', onSelect: () => addUnder('task') },
    isTask && { label: 'Add Note under', onSelect: () => addUnder('note') },
    { label: 'Edit', onSelect: () => startEditing(`item:${item.id}`) },
    isTask && { label: item.due ? 'Change due date' : 'Set due date', onSelect: () => setDueOpen(true) },
    !isTask && { label: 'Make Task', onSelect: () => apply((d, now) => makeTask(d, pid, item.id, now)) },
    canIndent(doc, item.id) && { label: 'Indent', onSelect: () => apply((d, now) => indent(d, pid, item.id, now)) },
    canOutdent(doc, item.id) && { label: 'Outdent', onSelect: () => apply((d, now) => outdent(d, pid, item.id, now)) },
    { label: item.crossed ? 'Un-cross' : 'Cross out', onSelect: toggleCross },
    canMoveToProject(doc, item.id) && { label: 'Move to Project…', onSelect: () => setMoving(true) },
    item.crossed && !item.bottomed && { label: '↓ Move to bottom', onSelect: () => apply((d, now) => sendToBottom(d, pid, item.id, now)) },
    item.crossed && { label: 'Delete…', danger: true, onSelect: () => setConfirmDelete(true) },
  ];

  const element = (
    <>
      {menu && (
        <Panel anchor={menu} onClose={() => setMenu(null)} label="Item menu">
          <Menu onClose={() => setMenu(null)} entries={entries} />
        </Panel>
      )}
      {moving && (
        <MoveSheet
          pid={pid}
          text={item.text}
          onPick={(to) => apply((d, now) => moveToProject(d, pid, item.id, to, now))}
          onClose={() => setMoving(false)}
        />
      )}
      {dueOpen && <DueSheet pid={pid} item={item} onClose={() => setDueOpen(false)} />}
      {confirmDelete && (
        <Confirm
          title={`Delete "${item.text.split('\n')[0]}"?`}
          body={`${under ? `This also deletes the ${under === 1 ? 'Item' : `${under} Items`} under it. ` : ''}You can restore it from the Change log.`}
          confirmLabel="Delete"
          onConfirm={() => apply((d, now) => deleteItem(d, pid, item.id, now, deviceName()))}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );

  return { open: setMenu, isOpen: !!menu, toggleCross, element };
}

/** ⋯ → Move to Project…: the other Projects, the current Workspace's first (spec §4.4). */
function MoveSheet({ pid, text, onPick, onClose }: { pid: string; text: string; onPick: (to: string) => void; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const workspace = useUi((s) => s.workspace);
  const here = shownProjectIds(data, workspace).filter((p) => p !== pid);
  const rest = workspace ? shownProjectIds(data, null).filter((p) => p !== pid && !here.includes(p)) : [];
  const row = (p: string) => (
    <button
      key={p}
      role="menuitem"
      className={data.docs[p].project.crossed ? 'crossed' : undefined}
      onClick={() => {
        onClose();
        onPick(p);
      }}
    >
      {data.docs[p].project.title}
    </button>
  );
  return (
    <Panel onClose={onClose} label="Move to Project">
      <div className="form">
        <p className="form-title">Move "{text.split('\n')[0]}" to…</p>
        <p className="hint">It goes to the end of that Project, with everything under it.</p>
        {here.length + rest.length === 0 && <p className="hint">There is no other Project yet.</p>}
        <div className="menu move-list" role="menu">
          {here.map(row)}
          {rest.length > 0 && <p className="menu-heading">Other Projects</p>}
          {rest.map(row)}
        </div>
      </div>
    </Panel>
  );
}

/** Rename a Project in place (Project list row, Map box). A new Project left without a name is discarded. */
export function useProjectRename(pid: string) {
  const apply = useStore((s) => s.apply);
  const { editing, fresh, startEditing, stopEditing } = useUi();
  const title = useStore((s) => s.data.docs[pid]?.project.title ?? '');
  const isFresh = fresh.has(pid);
  return {
    isEditing: editing === `project:${pid}`,
    startEdit: () => startEditing(`project:${pid}`),
    finishEdit: (t: string) => {
      stopEditing(pid);
      if (!t.trim()) {
        if (isFresh && !title) apply((d) => discardProject(d, pid));
        return;
      }
      if (t.trim() !== title) apply((d, now) => renameProject(d, pid, t.trim(), now));
    },
    cancelEdit: () => {
      stopEditing(pid);
      if (isFresh && !title) apply((d) => discardProject(d, pid));
    },
  };
}

/** The ⋯ menu of a Project. `extra` entries go first (the Map adds "Add Task"). */
export function useProjectMenu(pid: string, extra: MenuEntry[] = []) {
  const doc = useStore((s) => s.data.docs[pid]);
  const apply = useStore((s) => s.apply);
  const startEditing = useUi((s) => s.startEditing);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [membership, setMembership] = useState(false);
  if (!doc) return { open: setMenu, element: null };
  const p = doc.project;

  const entries: MenuEntry[] = [
    ...extra,
    { label: 'Rename', onSelect: () => startEditing(`project:${pid}`) },
    { label: 'Workspaces…', onSelect: () => setMembership(true) },
    {
      label: p.crossed ? 'Un-cross' : 'Cross out',
      onSelect: () => apply((d, now) => (p.crossed ? uncrossProject(d, pid, now) : crossProject(d, pid, now, deviceName()))),
    },
    p.crossed && !p.bottomed && { label: '↓ Move to bottom', onSelect: () => apply((d, now) => sendProjectToBottom(d, pid, now)) },
    p.crossed && { label: 'Delete…', danger: true, onSelect: () => setConfirmDelete(true) },
  ];
  const n = Object.keys(doc.items).length;

  const element = (
    <>
      {menu && (
        <Panel anchor={menu} onClose={() => setMenu(null)} label="Project menu">
          <Menu onClose={() => setMenu(null)} entries={entries} />
        </Panel>
      )}
      {membership && <ProjectWorkspaces pid={pid} onClose={() => setMembership(false)} />}
      {confirmDelete && (
        <Confirm
          title={`Delete the Project "${p.title}"?`}
          body={`${n ? `Its ${n === 1 ? 'Item goes' : `${n} Items go`} with it. ` : ''}You can restore it from the Change log.`}
          confirmLabel="Delete"
          onConfirm={() => apply((d, now) => deleteProject(d, pid, now, deviceName()))}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
  return { open: setMenu, element };
}
