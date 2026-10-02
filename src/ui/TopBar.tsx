import { useState } from 'react';
import { Menu, Panel } from './Panel';

export type ViewMode = 'list' | 'map';

type Props = {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  unpushed: number;
  hasToken: boolean;
  busy: 'pull' | 'push' | null;
  onOpenLog: () => void;
  onOpenSettings: () => void;
  onPush: () => void;
  onRefresh: () => void;
  workspaces: { id: string; name: string }[];
  workspace: string | null;
  onWorkspace: (wid: string | null) => void;
  onOpenWorkspaces: () => void;
  onSearch: () => void;
};

const EDIT = '__edit';

// Spec §5: menu, Workspace picker, List/Map switch, search, "N unpushed" badge (always visible), Push.
export function TopBar(props: Props) {
  const { view, onViewChange, unpushed, hasToken, busy, onOpenLog, onOpenSettings, onPush, onRefresh } = props;
  const { workspaces, workspace, onWorkspace, onOpenWorkspaces, onSearch } = props;
  const [menu, setMenu] = useState<DOMRect | null>(null);
  return (
    <header className="topbar">
      <button className="icon-btn" aria-label="Menu" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
        ☰
      </button>
      {menu && (
        <Panel anchor={menu} onClose={() => setMenu(null)} label="Menu">
          <Menu
            onClose={() => setMenu(null)}
            entries={[
              { label: 'Change log', onSelect: onOpenLog },
              { label: 'Workspaces', onSelect: onOpenWorkspaces },
              hasToken && { label: 'Refresh (Pull now)', onSelect: onRefresh },
              { label: hasToken ? 'Settings' : 'Set up GitHub', onSelect: onOpenSettings },
            ]}
          />
        </Panel>
      )}
      <select
        className="workspace"
        aria-label="Workspace"
        value={workspace ?? ''}
        onChange={(e) => (e.target.value === EDIT ? onOpenWorkspaces() : onWorkspace(e.target.value || null))}
      >
        <option value="">All Projects</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
        <option value={EDIT}>{workspaces.length ? 'Edit Workspaces…' : 'New Workspace…'}</option>
      </select>
      <div className="switch" role="group" aria-label="View">
        <button aria-pressed={view === 'list'} onClick={() => onViewChange('list')}>
          List
        </button>
        <button aria-pressed={view === 'map'} onClick={() => onViewChange('map')}>
          Map
        </button>
      </div>
      <span className="spacer" />
      <button className="icon-btn" aria-label="Search" title="Search" onClick={onSearch}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15 15l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span className="badge" title={`${unpushed} unpushed changes`}>
        {unpushed}
        <span className="wide-only"> unpushed</span>
      </span>
      <button
        className={busy ? 'push busy' : 'push'}
        disabled={busy === 'push'}
        onClick={hasToken ? onPush : onOpenSettings}
        title={busy === 'pull' ? 'Pulling from GitHub…' : busy === 'push' ? 'Pushing to GitHub…' : undefined}
      >
        {hasToken ? (
          busy === 'push' ? 'Pushing…' : 'Push'
        ) : (
          <>
            Set up<span className="wide-only"> GitHub</span>
          </>
        )}
      </button>
    </header>
  );
}
