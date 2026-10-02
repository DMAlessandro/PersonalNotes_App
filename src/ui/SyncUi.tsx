import { useEffect, useMemo } from 'react';
import { emptyData } from '../domain/model';
import { countUnpushed } from '../sync/changes';
import { useStore } from '../store/store';
import { useSync } from '../store/sync';
import { Panel } from './Panel';

/** The "N unpushed" badge (spec §2.2): what differs from the last pulled version, folds not counted. */
export function useUnpushed(): number {
  const data = useStore((s) => s.data);
  const base = useSync((s) => s.base);
  return useMemo(() => countUnpushed(base?.data ?? emptyData(), data), [base, data]);
}

/** Short messages after Pull / Push. Info fades; errors stay until closed. */
export function Toast({ onSettings }: { onSettings: () => void }) {
  const { notice, dismiss } = useSync();
  useEffect(() => {
    if (notice?.kind !== 'info') return;
    const t = window.setTimeout(dismiss, 4000);
    return () => window.clearTimeout(t);
  }, [notice, dismiss]);
  if (!notice) return null;
  return (
    <div className={`toast ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      {notice.action === 'settings' && (
        <button
          className="secondary small"
          onClick={() => {
            dismiss();
            onSettings();
          }}
        >
          Settings
        </button>
      )}
      <button className="icon-btn" aria-label="Dismiss" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}

/** First connection when both this device and GitHub hold Projects. */
export function FirstConnectChoice() {
  const { choice, resolveChoice } = useSync();
  const local = useStore((s) => Object.keys(s.data.docs).length);
  if (!choice) return null;
  const remote = Object.keys(choice.remote.docs).length;
  const n = (k: number) => `${k} ${k === 1 ? 'Project' : 'Projects'}`;
  return (
    <Panel onClose={() => void resolveChoice(null)} label="Connect this device">
      <div className="form">
        <p className="form-title">This device and GitHub both have Projects</p>
        <p className="form-body">
          This device: {n(local)}. GitHub: {n(remote)}.
        </p>
        <button className="primary" onClick={() => void resolveChoice('both')}>
          Keep both
        </button>
        <p className="hint">All Projects from both sides; press Push afterwards to send this device's to GitHub.</p>
        <button className="secondary danger-text" onClick={() => void resolveChoice('github')}>
          Use GitHub's only
        </button>
        <p className="hint">
          This device's {n(local)} {local === 1 ? 'is' : 'are'} discarded and replaced by GitHub's.
        </p>
      </div>
    </Panel>
  );
}
