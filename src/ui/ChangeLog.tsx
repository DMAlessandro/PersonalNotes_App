import { groupByWeek, weekLabel } from '../domain/changelog';
import { useEscape } from './useEscape';
import { canRestore, canUncrossEntry, restore, uncrossEntry } from '../domain/lifecycle';
import type { LogEntry } from '../domain/model';
import { todayLocal } from '../domain/time';
import { deviceName } from '../store/device';
import { useStore } from '../store/store';
import { shortDate } from './format';

const ACTION: Record<LogEntry['action'], string> = {
  crossed: 'Crossed out',
  deleted: 'Deleted',
  restored: 'Restored',
};

/**
 * Spec §5.5. `pid` set: that Project's Log (the Log button). `pid` null: the global Change log (☰),
 * which includes Deleted Projects. Grouped by week, newest first. Entries are permanent.
 */
export function ChangeLog({ pid, onClose }: { pid: string | null; onClose: () => void }) {
  useEscape(onClose);
  const log = useStore((s) => s.data.log);
  const data = useStore((s) => s.data);
  const apply = useStore((s) => s.apply);
  const today = todayLocal();
  const entries = Object.values(log).filter((e) => pid === null || e.projectId === pid);
  const groups = groupByWeek(entries);
  // Un-cross is offered once per Item: on its newest Cross-out entry.
  const newestCross = new Set<string>();
  const seen = new Set<string>();
  for (const e of groups.flatMap((g) => g.entries)) {
    const key = `${e.projectId}/${e.itemId ?? ''}`;
    if (e.action === 'crossed' && !seen.has(key)) newestCross.add(e.id);
    if (e.action === 'crossed') seen.add(key);
  }
  const title = pid ? `Log · ${data.docs[pid]?.project.title ?? ''}` : 'Change log';

  return (
    <div className="log-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="log" aria-label={title}>
        <header className="log-header">
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ←
          </button>
          <h2>{title}</h2>
        </header>
        <div className="log-body">
          {groups.length === 0 && (
            <div className="empty">
              <p className="empty-hint">Nothing crossed out or deleted yet.</p>
            </div>
          )}
          {groups.map((g) => (
            <section key={g.week}>
              <h3 className="log-week">{weekLabel(g.week, today)}</h3>
              {g.entries.map((e) => (
                <article key={e.id} className={`log-entry ${e.action}`}>
                  <div className="log-line">
                    <span className={`log-action ${e.action}`}>{ACTION[e.action]}</span>
                    <span className="log-when">
                      {`${shortDate(e.at)}, ${e.at.slice(11, 16)} · ${e.device}`}
                    </span>
                  </div>
                  <p className={e.action === 'restored' ? 'log-text' : 'log-text struck'}>
                    {e.itemId === null && <span className="log-kind">Project</span>}
                    {e.text.split('\n')[0] || '(empty)'}
                  </p>
                  <p className="log-sub">
                    {[
                      pid === null && e.itemId !== null && e.projectTitle,
                      e.itemId === null
                        ? `${e.count} ${e.count === 1 ? 'Item' : 'Items'}`
                        : e.count > 1 && `${e.count - 1} ${e.count === 2 ? 'Item' : 'Items'} under it`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <EntryAction
                    e={e}
                    canRestore={canRestore(data, e)}
                    canUncross={newestCross.has(e.id) && canUncrossEntry(data, e)}
                    onRestore={() => apply((d, now) => restore(d, e.id, now, deviceName()))}
                    onUncross={() => apply((d, now) => uncrossEntry(d, e.id, now))}
                  />
                </article>
              ))}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

type ActionProps = {
  e: LogEntry;
  canRestore: boolean;
  canUncross: boolean;
  onRestore: () => void;
  onUncross: () => void;
};

function EntryAction({ e, canRestore, canUncross, onRestore, onUncross }: ActionProps) {
  if (e.action === 'deleted') {
    return canRestore ? (
      <button className="secondary small" onClick={onRestore}>
        Restore
      </button>
    ) : (
      <span className="log-note">Back in place</span>
    );
  }
  if (e.action === 'crossed' && canUncross) {
    return (
      <button className="secondary small" onClick={onUncross}>
        Un-cross
      </button>
    );
  }
  return null;
}
