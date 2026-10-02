import { useState } from 'react';
import { Menu, Panel } from './Panel';

export type ViewMode = 'list' | 'map';

type Props = {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  unpushed: number;
  hasToken: boolean;
  onOpenLog: () => void;
};

// Spec §5: menu, Workspace picker, List/Map switch, search, "N unpushed" badge (always visible), Push.
export function TopBar({ view, onViewChange, unpushed, hasToken, onOpenLog }: Props) {
  const [menu, setMenu] = useState<DOMRect | null>(null);
  return (
    <header className="topbar">
      <button className="icon-btn" aria-label="Menu" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
        ☰
      </button>
      {menu && (
        <Panel anchor={menu} onClose={() => setMenu(null)} label="Menu">
          <Menu onClose={() => setMenu(null)} entries={[{ label: 'Change log', onSelect: onOpenLog }]} />
        </Panel>
      )}
      <select className="workspace" aria-label="Workspace" defaultValue="all">
        <option value="all">All Projects</option>
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
      <button className="icon-btn" aria-label="Search" disabled>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15 15l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span className="badge" title={`${unpushed} unpushed changes`}>
        {unpushed}
        <span className="wide-only"> unpushed</span>
      </span>
      <button className="push" disabled>
        {hasToken ? (
          'Push'
        ) : (
          <>
            Set up<span className="wide-only"> GitHub</span>
          </>
        )}
      </button>
    </header>
  );
}
