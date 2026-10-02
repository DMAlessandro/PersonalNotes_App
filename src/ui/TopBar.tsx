export type ViewMode = 'list' | 'map';

type Props = {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  unpushed: number;
  hasToken: boolean;
};

// Spec §5: menu, Workspace picker, List/Map switch, search, "N unpushed" badge (always visible), Push.
export function TopBar({ view, onViewChange, unpushed, hasToken }: Props) {
  return (
    <header className="topbar">
      <button className="icon-btn" aria-label="Menu" disabled>
        ☰
      </button>
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
