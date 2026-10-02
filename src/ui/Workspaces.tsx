import { useState } from 'react';
import { useEscape } from './useEscape';
import { newId } from '../domain/ids';
import { sortedProjectIds } from '../domain/ordering';
import { addWorkspace, deleteWorkspace, renameWorkspace, setMember, sortedWorkspaces } from '../domain/workspaces';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { Confirm } from './Confirm';
import { Panel } from './Panel';

/** Text field that adds a Workspace on Enter or the Add button. */
function NewWorkspace({ onAdded }: { onAdded?: (wid: string) => void }) {
  const apply = useStore((s) => s.apply);
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    const id = newId('w');
    apply((d, now) => addWorkspace(d, { id, name }, now));
    setName('');
    onAdded?.(id);
  };
  return (
    <form
      className="ws-new"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <input className="field" value={name} placeholder="New Workspace name" onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="secondary" disabled={!name.trim()}>
        Add
      </button>
    </form>
  );
}

/**
 * Workspace settings (ticket 02, spec §5.7): add, rename, delete, and tick each one's Projects.
 * Every change is Saved at once, like any other edit.
 */
export function Workspaces({ onClose }: { onClose: () => void }) {
  useEscape(onClose);
  const data = useStore((s) => s.data);
  const apply = useStore((s) => s.apply);
  const { workspace, setWorkspace } = useUi();
  const [openWs, setOpenWs] = useState<string | null>(workspace);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const list = sortedWorkspaces(data);
  const projects = sortedProjectIds(data);

  return (
    <div className="log-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="log settings" aria-label="Workspaces">
        <header className="log-header">
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ←
          </button>
          <h2>Workspaces</h2>
        </header>
        <div className="log-body">
          <p className="intro">
            A Workspace is a selection of Projects. Picking it at the top shows only those Projects. <b>All Projects</b>{' '}
            always shows every one.
          </p>
          <NewWorkspace onAdded={setOpenWs} />
          {list.length === 0 && <p className="hint">No Workspaces yet.</p>}
          {list.map((w) => {
            const open = openWs === w.id;
            return (
              <section key={w.id} className="ws">
                <div className="ws-head">
                  <button
                    className="fold"
                    aria-label={open ? 'Hide Projects' : 'Show Projects'}
                    aria-expanded={open}
                    onClick={() => setOpenWs(open ? null : w.id)}
                  >
                    {open ? '▾' : '▸'}
                  </button>
                  <input
                    className="field ws-name"
                    aria-label="Workspace name"
                    defaultValue={w.name}
                    key={w.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v) e.target.value = w.name;
                      else if (v !== w.name) apply((d, now) => renameWorkspace(d, w.id, v, now));
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  <span className="count">{w.projects.length === 1 ? '1 Project' : `${w.projects.length} Projects`}</span>
                  <button className="secondary small danger-text" onClick={() => setConfirmDelete(w.id)}>
                    Delete
                  </button>
                </div>
                {open && (
                  <ul className="ws-projects">
                    {projects.length === 0 && <li className="hint">No Projects yet.</li>}
                    {projects.map((pid) => (
                      <li key={pid}>
                        <label className={data.docs[pid].project.crossed ? 'crossed' : undefined}>
                          <input
                            type="checkbox"
                            checked={w.projects.includes(pid)}
                            onChange={(e) => apply((d, now) => setMember(d, w.id, pid, e.target.checked, now))}
                          />
                          {data.docs[pid].project.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </aside>
      {confirmDelete && data.index.workspaces[confirmDelete] && (
        <Confirm
          title={`Delete the Workspace "${data.index.workspaces[confirmDelete].name}"?`}
          body="Only the selection goes. Its Projects stay, under All Projects and any other Workspace they are in."
          confirmLabel="Delete"
          onConfirm={() => {
            if (workspace === confirmDelete) setWorkspace(null);
            apply((d) => deleteWorkspace(d, confirmDelete));
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/** ⋯ → Workspaces… on a Project: tick the Workspaces it belongs to, or make a new one for it. */
export function ProjectWorkspaces({ pid, onClose }: { pid: string; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const apply = useStore((s) => s.apply);
  const list = sortedWorkspaces(data);
  const title = data.docs[pid]?.project.title ?? '';
  return (
    <Panel onClose={onClose} label="Workspaces">
      <div className="form">
        <p className="form-title">Workspaces for "{title}"</p>
        {list.length === 0 && <p className="hint">No Workspaces yet. Name one to put this Project in it.</p>}
        <ul className="ws-projects">
          {list.map((w) => (
            <li key={w.id}>
              <label>
                <input
                  type="checkbox"
                  checked={w.projects.includes(pid)}
                  onChange={(e) => apply((d, now) => setMember(d, w.id, pid, e.target.checked, now))}
                />
                {w.name}
              </label>
            </li>
          ))}
        </ul>
        <NewWorkspace onAdded={(wid) => apply((d, now) => setMember(d, wid, pid, true, now))} />
        <div className="actions">
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Panel>
  );
}
