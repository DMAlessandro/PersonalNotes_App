import { useState } from 'react';
import { addProject, moveProject, renameProject } from '../domain/edits';
import { newId } from '../domain/ids';
import { openTaskCount, projectDeadline, sortedProjectIds } from '../domain/ordering';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { DueChip } from './format';
import { Menu, Panel } from './Panel';
import { TextEditor } from './TextEditor';
import { useDrag } from './useDrag';
import { useLongPress } from './useLongPress';
import { Confirm } from './Confirm';
import { crossProject, deleteProject, sendProjectToBottom, uncrossProject } from '../domain/lifecycle';
import { deviceName } from '../store/device';

/** Spec §5.1: the Projects in the one manual order, dated ones first. */
export function ProjectList({ onOpen }: { onOpen: (pid: string) => void }) {
  const data = useStore((s) => s.data);
  const apply = useStore((s) => s.apply);
  const { openProject, editing, startEditing, stopEditing } = useUi();
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{ pid: string; at: DOMRect } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const toggleCross = (pid: string) =>
    apply((d, now) =>
      d.docs[pid].project.crossed ? uncrossProject(d, pid, now) : crossProject(d, pid, now, deviceName()),
    );
  const drag = useDrag('projects', (id, index) => apply((d, now) => moveProject(d, id, index, now)));
  const ids = sortedProjectIds(data);
  const longPress = useLongPress((el) => {
    const pid = el.dataset.dragId;
    if (pid) setMenu({ pid, at: el.getBoundingClientRect() });
  });

  return (
    <nav className="project-list" aria-label="Projects">
      {ids.length === 0 && !creating && (
        <div className="empty">
          <p className="empty-title">No Projects yet</p>
          <p className="empty-hint">Add one to start.</p>
        </div>
      )}
      <ul>
        {ids.map((pid) => {
          const doc = data.docs[pid];
          const deadline = projectDeadline(doc);
          const open = openTaskCount(doc);
          const renaming = editing === `project:${pid}`;
          return (
            <li
              key={pid}
              data-drag-group="projects"
              data-drag-id={pid}
              className={`p-row${pid === openProject ? ' selected' : ''}${doc.project.crossed ? ' crossed' : ''}`}
              {...(renaming ? {} : longPress)}
            >
              <button className="handle" aria-label="Drag to reorder" onPointerDown={drag(pid)}>
                ⠿
              </button>
              {renaming ? (
                <TextEditor
                  className="title-editor"
                  initial={doc.project.title}
                  onDone={(t) => {
                    stopEditing();
                    if (t.trim() && t !== doc.project.title) apply((d, now) => renameProject(d, pid, t.trim(), now));
                  }}
                  onCancel={() => stopEditing()}
                />
              ) : (
                <button className="p-open" onClick={() => onOpen(pid)}>
                  <span className="p-title">{doc.project.title}</span>
                  <span className="p-meta">
                    {deadline && <DueChip due={deadline} />}
                    <span className="count">{open === 1 ? '1 open' : `${open} open`}</span>
                  </span>
                </button>
              )}
              {doc.project.crossed && !doc.project.bottomed && (
                <button
                  className="to-bottom"
                  title="Move to the bottom of the list"
                  onClick={() => apply((d, now) => sendProjectToBottom(d, pid, now))}
                >
                  ↓ bottom
                </button>
              )}
              <button
                className="more"
                aria-label="Project menu"
                onClick={(e) => setMenu({ pid, at: e.currentTarget.getBoundingClientRect() })}
              >
                ⋯
              </button>
            </li>
          );
        })}
      </ul>
      {creating ? (
        <div className="p-new">
          <TextEditor
            className="title-editor"
            initial=""
            placeholder="Project name"
            onDone={(t) => {
              setCreating(false);
              if (!t.trim()) return;
              const id = newId('p');
              apply((d, now) => addProject(d, { id, title: t.trim() }, now));
              onOpen(id);
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button className="add-project" onClick={() => setCreating(true)}>
          + New Project
        </button>
      )}
      {menu && (
        <Panel anchor={menu.at} onClose={() => setMenu(null)} label="Project menu">
          <Menu
            onClose={() => setMenu(null)}
            entries={[
              { label: 'Rename', onSelect: () => startEditing(`project:${menu.pid}`) },
              { label: data.docs[menu.pid].project.crossed ? 'Un-cross' : 'Cross out', onSelect: () => toggleCross(menu.pid) },
              data.docs[menu.pid].project.crossed &&
                !data.docs[menu.pid].project.bottomed && {
                  label: '↓ Move to bottom',
                  onSelect: () => apply((d, now) => sendProjectToBottom(d, menu.pid, now)),
                },
              data.docs[menu.pid].project.crossed && {
                label: 'Delete…',
                danger: true,
                onSelect: () => setConfirmDelete(menu.pid),
              },
            ]}
          />
        </Panel>
      )}
      {confirmDelete && data.docs[confirmDelete] && (
        <Confirm
          title={`Delete the Project "${data.docs[confirmDelete].project.title}"?`}
          body={(() => {
            const n = Object.keys(data.docs[confirmDelete].items).length;
            return `${n ? `Its ${n === 1 ? 'Item goes' : `${n} Items go`} with it. ` : ''}You can restore it from the Change log.`;
          })()}
          confirmLabel="Delete"
          onConfirm={() => apply((d, now) => deleteProject(d, confirmDelete, now, deviceName()))}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </nav>
  );
}
