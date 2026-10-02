import { useState } from 'react';
import { addItem, moveItem, renameProject } from '../domain/edits';
import { newId } from '../domain/ids';
import { children, projectDeadline } from '../domain/ordering';
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
  const [adding, setAdding] = useState(false);
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

      <button className="fab" aria-label="Add Task" onClick={() => setAdding(true)}>
        +
      </button>
      {adding && <AddTaskPanel pid={pid} onClose={() => setAdding(false)} />}
    </section>
  );
}

/** + opens a bottom panel: text and an optional due date. Only Tasks at the top level (spec §5.2). */
function AddTaskPanel({ pid, onClose }: { pid: string; onClose: () => void }) {
  const apply = useStore((s) => s.apply);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');

  const add = () => {
    if (!text.trim()) return;
    apply((d, now) => addItem(d, pid, { id: newId('i'), type: 'task', text: text.trim(), parent: null, due: due || null }, now));
    setText('');
    setDue('');
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
        <p className="form-title">New Task</p>
        <textarea
          className="field"
          rows={2}
          value={text}
          placeholder="What needs doing?"
          autoFocus
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
