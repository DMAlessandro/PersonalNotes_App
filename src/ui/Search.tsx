import { useMemo, useState } from 'react';
import { search, type SearchResult } from '../domain/search';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { DueChip } from './format';

/** The text with every case-insensitive match of `q` marked. */
function Marked({ text, q }: { text: string; q: string }) {
  const parts: (string | { m: string })[] = [];
  const lower = text.toLowerCase();
  const needle = q.trim().toLowerCase();
  let at = 0;
  for (let i = needle ? lower.indexOf(needle) : -1; i >= 0; i = lower.indexOf(needle, i + needle.length)) {
    parts.push(text.slice(at, i), { m: text.slice(i, i + needle.length) });
    at = i + needle.length;
  }
  parts.push(text.slice(at));
  return (
    <>
      {parts.map((p, n) => (typeof p === 'string' ? p : <mark key={n}>{p.m}</mark>))}
    </>
  );
}

/**
 * Spec §5.4 / ticket 10: Item text across all Projects, the current Workspace first, then Other Projects.
 * Full screen on a phone, a side panel on a laptop. Tapping a result jumps to it.
 */
export function Search({ onClose, onJump }: { onClose: () => void; onJump: (r: SearchResult) => void }) {
  const data = useStore((s) => s.data);
  const workspace = useUi((s) => s.workspace);
  const [q, setQ] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const found = useMemo(() => search(data, q, { workspace, dueOnly }), [data, q, workspace, dueOnly]);
  const wsName = workspace ? data.index.workspaces[workspace]?.name : null;
  const none = q.trim() && found.here.length + found.other.length === 0;

  const list = (rs: SearchResult[]) =>
    rs.map((r) => (
      <li key={r.item.id}>
        <button className={`result${r.item.crossed ? ' crossed' : ''}${r.item.type === 'note' ? ' note' : ''}`} onClick={() => onJump(r)}>
          <span className="result-text">
            <Marked text={r.item.text} q={q} />
          </span>
          <span className="result-where">
            {r.item.due && <DueChip due={r.item.due} muted={r.item.crossed} />}
            <span>{[r.projectTitle, ...r.path].join(' › ')}</span>
          </span>
        </button>
      </li>
    ));

  return (
    <div className="log-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="log search" aria-label="Search">
        <header className="log-header">
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ←
          </button>
          <input
            className="field search-field"
            type="search"
            value={q}
            placeholder="Search Tasks and Notes"
            aria-label="Search Tasks and Notes"
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              const first = found.here[0] ?? found.other[0];
              if (e.key === 'Enter' && first) onJump(first);
            }}
          />
        </header>
        <div className="log-body">
          <label className="filter">
            <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
            Has due date
          </label>
          {!q.trim() && <p className="hint">Type a word to search every Project.</p>}
          {none && <p className="hint">Nothing found.</p>}
          {found.here.length > 0 && (
            <section>
              {wsName && <h3 className="log-week">{wsName}</h3>}
              <ul className="results">{list(found.here)}</ul>
            </section>
          )}
          {found.other.length > 0 && (
            <section>
              <h3 className="log-week">Other Projects</h3>
              <ul className="results">{list(found.other)}</ul>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
