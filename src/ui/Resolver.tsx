import type { Clash } from '../domain/merge';
import type { Item, Project } from '../domain/model';
import { useStore } from '../store/store';
import { useSync } from '../store/sync';
import { shortDate } from './format';
import { Panel } from './Panel';

const when = (t: string) => `${shortDate(t)}, ${t.slice(11, 16)}`;

function Side({ title, c, side }: { title: string; c: Clash; side: 'local' | 'remote' }) {
  const v = c[side];
  const mark = (f: string) => (c.fields.includes(f) ? 'res-field clash' : 'res-field');
  if (c.kind === 'project') {
    const p = v as Project;
    return (
      <div className="res-side">
        <p className="res-head">{title}</p>
        <p className={mark('title')}>{p.title}</p>
        <p className="res-when">changed {when(p.contentAt)}</p>
      </div>
    );
  }
  const it = v as Item;
  return (
    <div className="res-side">
      <p className="res-head">{title}</p>
      <p className={mark('text')}>{it.text || '(empty)'}</p>
      {it.type === 'task' && (
        <>
          <p className={mark('due')}>Due: {it.due ? shortDate(it.due) : 'none'}</p>
          <p className="res-field">{it.crossed ? 'Ticked' : 'Not ticked'}</p>
        </>
      )}
      <p className="res-when">changed {when(it.contentAt)}</p>
    </div>
  );
}

/** Spec §5.6: one Clash at a time, side by side, Keep this device's / Keep the other's / Keep both. */
export function Resolver() {
  const { clashes, resolverOpen, settle, setResolverOpen } = useSync();
  const projectTitle = useStore((s) => (clashes[0] ? s.data.docs[clashes[0].pid]?.project.title : ''));
  if (!resolverOpen || !clashes.length) return null;
  const c = clashes[0];
  return (
    <Panel onClose={() => setResolverOpen(false)} label="Settle a clash">
      <div className="form resolver">
        <p className="form-title">
          {c.kind === 'project' ? 'Project renamed on both devices' : 'Changed on both devices'}
          {clashes.length > 1 && <span className="res-count">{` 1 of ${clashes.length}`}</span>}
        </p>
        {c.kind === 'item' && <p className="form-sub">in {projectTitle}</p>}
        <div className="res-sides">
          <Side title="This device" c={c} side="local" />
          <Side title="Other device" c={c} side="remote" />
        </div>
        <div className="res-actions">
          <button className="secondary" onClick={() => void settle('this')}>
            Keep this device's
          </button>
          <button className="secondary" onClick={() => void settle('other')}>
            Keep the other's
          </button>
          {c.kind === 'item' && (
            <button className="primary" onClick={() => void settle('both')}>
              Keep both
            </button>
          )}
        </div>
        {c.kind === 'item' && <p className="hint">Keep both adds the other device's version as a separate Item right below.</p>}
      </div>
    </Panel>
  );
}
