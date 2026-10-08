import { useState, type PointerEvent } from 'react';
import { addProject, moveProject } from '../domain/edits';
import { newId } from '../domain/ids';
import { openTaskCount, projectDeadline } from '../domain/ordering';
import { shownProjectIds } from '../domain/workspaces';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { DueChip } from './format';
import { TextEditor } from './TextEditor';
import { useDrag } from './useDrag';
import { useLongPress } from './useLongPress';
import { useProjectMenu, useProjectRename } from './itemActions';
import { CrossedSection } from './CrossedSection';

/** Spec §5.1: the current Workspace's Projects in the one manual order, dated ones first. */
export function ProjectList({ onOpen }: { onOpen: (pid: string) => void }) {
  const data = useStore((s) => s.data);
  const apply = useStore((s) => s.apply);
  const workspace = useUi((s) => s.workspace);
  const [creating, setCreating] = useState(false);
  const drag = useDrag('projects', (id, index) =>
    apply((d, now) => moveProject(d, id, index, now, shownProjectIds(d, useUi.getState().workspace))),
  );
  const ids = shownProjectIds(data, workspace);
  const open = ids.filter((pid) => !data.docs[pid].project.crossed);
  const crossed = ids.filter((pid) => data.docs[pid].project.crossed);
  const wsName = workspace ? data.index.workspaces[workspace]?.name : undefined;

  return (
    <nav className="project-list" aria-label="Projects">
      {ids.length === 0 && !creating && (
        <div className="empty">
          <p className="empty-title">{wsName ? `No Projects in ${wsName}` : 'No Projects yet'}</p>
          <p className="empty-hint">
            {wsName ? 'Add one here, or pick Projects with ⋯ → Workspaces… under All Projects.' : 'Add one to start.'}
          </p>
        </div>
      )}
      <ul>
        {open.map((pid) => (
          <ProjectRow key={pid} pid={pid} onOpen={onOpen} dragHandle={drag} />
        ))}
        <CrossedSection id="projects" as="li" count={crossed.length}>
          {crossed.map((pid) => (
            <ProjectRow key={pid} pid={pid} onOpen={onOpen} dragHandle={drag} />
          ))}
        </CrossedSection>
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
              apply((d, now) => addProject(d, { id, title: t.trim() }, now, workspace));
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
    </nav>
  );
}

type RowProps = {
  pid: string;
  onOpen: (pid: string) => void;
  dragHandle: (id: string) => (e: PointerEvent<HTMLElement>) => void;
};

function ProjectRow({ pid, onOpen, dragHandle }: RowProps) {
  const doc = useStore((s) => s.data.docs[pid]);
  const selected = useUi((s) => s.openProject === pid);
  const rename = useProjectRename(pid);
  const menu = useProjectMenu(pid);
  const longPress = useLongPress((el) => menu.open(el.getBoundingClientRect()));
  const deadline = projectDeadline(doc);
  const open = openTaskCount(doc);

  return (
    <li
      data-drag-group="projects"
      data-drag-id={pid}
      className={`p-row${selected ? ' selected' : ''}${doc.project.crossed ? ' crossed' : ''}`}
      {...(rename.isEditing ? {} : longPress)}
    >
      <button className="handle" aria-label="Drag to reorder" onPointerDown={dragHandle(pid)}>
        ⠿
      </button>
      {rename.isEditing ? (
        <TextEditor className="title-editor" initial={doc.project.title} onDone={rename.finishEdit} onCancel={rename.cancelEdit} />
      ) : (
        <button className="p-open" onClick={() => onOpen(pid)}>
          <span className="p-title">{doc.project.title}</span>
          <span className="p-meta">
            {deadline && <DueChip due={deadline} />}
            <span className="count">{open === 1 ? '1 open' : `${open} open`}</span>
          </span>
        </button>
      )}
      <button className="more" aria-label="Project menu" onClick={(e) => menu.open(e.currentTarget.getBoundingClientRect())}>
        ⋯
      </button>
      {menu.element}
    </li>
  );
}
