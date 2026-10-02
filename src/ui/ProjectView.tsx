import { useState } from 'react';
import { addItem, moveItem, renameProject, setFolded } from '../domain/edits';
import { newId } from '../domain/ids';
import { children, projectDeadline, taskOutline } from '../domain/ordering';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { DueChip } from './format';
import { groupOf, ItemNode } from './ItemNode';
import { Panel } from './Panel';
import { TextEditor } from './TextEditor';
import { useDrag } from './useDrag';

/** The Cards List view of one Project (spec §5.2). */
export function ProjectView({ pid, onBack }: { pid: string; onBack?: () => void }) {
  const doc = useStore((s) => s.data.docs[pid]);
  const apply = useStore((s) => s.apply);
  const { editing, startEditing, stopEditing } = useUi();
  const [adding, setAdding] = useState<'task' | 'subtask' | null>(null);
  const drag = useDrag(groupOf(pid, null), (id, index) => apply((d, now) => moveItem(d, pid, id, index, now)));

  if (!doc) return null;
  const top = children(doc, null);
  const deadline = projectDeadline(doc);
  const renaming = editing === `project:${pid}`;

  return (
    <section className="project-view">
      <header className="pv-header">
        {onBack && (
          <button className="icon-btn" aria-label="Back to Projects" onClick={onBack}>
            ←
          </button>
        )}
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
          <h1 className="pv-title" onDoubleClick={() => startEditing(`project:${pid}`)}>
            {doc.project.title}
          </h1>
        )}
        {deadline && <DueChip due={deadline} />}
        <button className="secondary small" disabled title="The Change log arrives in the next build step">
          Log
        </button>
      </header>

      {top.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No Tasks yet</p>
          <p className="empty-hint">Tap + to add the first Task.</p>
        </div>
      ) : (
        <div className="cards">
          {top.map((it) => (
            <ItemNode key={it.id} doc={doc} item={it} depth={0} dragHandle={drag} />
          ))}
        </div>
      )}

      <div className="fabs">
        {top.length > 0 && (
          <button className="fab-sub" aria-label="Add Subtask" title="Add Subtask" onClick={() => setAdding('subtask')}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 4v9a3 3 0 0 0 3 3h9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M15 13l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Subtask</span>
          </button>
        )}
        <button className="fab" aria-label="Add Task" onClick={() => setAdding('task')}>
          +
        </button>
      </div>
      {adding === 'task' && <AddTaskPanel pid={pid} onClose={() => setAdding(null)} />}
      {adding === 'subtask' && <AddTaskPanel pid={pid} subtask onClose={() => setAdding(null)} />}
    </section>
  );
}

/**
 * + opens a bottom panel: text and an optional due date, for a top-level Task (spec §5.2).
 * The Subtask shortcut next to it (user, 2026-10-02) adds the same panel with an "Under" Task picker,
 * which remembers the last Task chosen in this Project.
 */
function AddTaskPanel({ pid, subtask, onClose }: { pid: string; subtask?: boolean; onClose: () => void }) {
  const apply = useStore((s) => s.apply);
  const doc = useStore((s) => s.data.docs[pid]);
  const { lastSubtaskParent, rememberSubtaskParent } = useUi();
  const tasks = taskOutline(doc);
  const remembered = lastSubtaskParent[pid];
  const [parent, setParent] = useState(
    tasks.some((t) => t.item.id === remembered) ? remembered : (tasks[0]?.item.id ?? ''),
  );
  const [text, setText] = useState('');
  const [due, setDue] = useState('');

  const add = () => {
    if (!text.trim() || (subtask && !parent)) return;
    const under = subtask ? parent : null;
    apply((d, now) => {
      // Unfold the chosen Task so the new Subtask is visible.
      const opened = under && d.docs[pid].items[under]?.folded ? setFolded(d, pid, under, false, now) : d;
      return addItem(opened, pid, { id: newId('i'), type: 'task', text: text.trim(), parent: under, due: due || null }, now);
    });
    if (under) rememberSubtaskParent(pid, under);
  };

  return (
    <Panel onClose={onClose} label="Add Task">
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
          onClose();
        }}
      >
        <p className="form-title">{subtask ? 'New Subtask' : 'New Task'}</p>
        {subtask && (
          <label className="field-row">
            Under
            <select className="field" value={parent} onChange={(e) => setParent(e.target.value)}>
              {tasks.map(({ item, depth }) => (
                <option key={item.id} value={item.id}>
                  {'\u00a0\u00a0\u00a0'.repeat(depth) + (depth ? '↳ ' : '') + item.text.split('\n')[0]}
                </option>
              ))}
            </select>
          </label>
        )}
        <textarea
          className="field"
          rows={2}
          value={text}
          placeholder={subtask ? 'Subtask' : 'What needs doing?'}
          autoFocus={!subtask}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
              onClose();
            }
          }}
        />
        <label className="field-row">
          Due date
          <input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <div className="actions">
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!text.trim()}>
            Add
          </button>
        </div>
      </form>
    </Panel>
  );
}
