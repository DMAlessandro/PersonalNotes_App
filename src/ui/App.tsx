import { useState } from 'react';
import { TopBar, type ViewMode } from './TopBar';

// Slice 1 shell: the top bar from spec §5 with placeholders, and the empty Project list.
export function App() {
  const [view, setView] = useState<ViewMode>('list');

  return (
    <div className="app">
      <TopBar view={view} onViewChange={setView} unpushed={0} hasToken={false} />
      <main className="empty">
        <p className="empty-title">No Projects yet</p>
        <p className="empty-hint">
          {view === 'list'
            ? 'Projects and their Tasks will appear here.'
            : 'The Map view of the current Workspace will appear here.'}
        </p>
      </main>
    </div>
  );
}
