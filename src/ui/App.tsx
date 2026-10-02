import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { ProjectList } from './ProjectList';
import { ProjectView } from './ProjectView';
import { TopBar, type ViewMode } from './TopBar';
import { useWide } from './useWide';

export function App() {
  const [view, setView] = useState<ViewMode>('list');
  const { loaded, load, saveError } = useStore();
  const { openProject, setOpenProject } = useUi();
  const exists = useStore((s) => (openProject ? !!s.data.docs[openProject] : false));
  const wide = useWide();

  useEffect(() => {
    void load();
  }, [load]);

  // Phone: opening a Project is a history step, so Android's back gesture returns to the list.
  useEffect(() => {
    const onPop = () => setOpenProject(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setOpenProject]);

  const open = (pid: string) => {
    if (!wide && !openProject) history.pushState({ project: pid }, '');
    setOpenProject(pid);
  };
  const back = () => (history.state?.project ? history.back() : setOpenProject(null));

  const current = openProject && exists ? openProject : null;

  return (
    <div className="app">
      <TopBar view={view} onViewChange={setView} unpushed={0} hasToken={false} />
      {saveError && <div className="banner error">{saveError}</div>}
      {view === 'map' ? (
        <main className="empty">
          <p className="empty-title">Map view</p>
          <p className="empty-hint">The Map view arrives in a later build step.</p>
        </main>
      ) : !loaded ? (
        <main className="empty" />
      ) : wide ? (
        <main className="split">
          <ProjectList onOpen={open} />
          {current ? (
            <ProjectView pid={current} />
          ) : (
            <div className="empty">
              <p className="empty-hint">Pick a Project, or add one.</p>
            </div>
          )}
        </main>
      ) : (
        <main className="single">{current ? <ProjectView pid={current} onBack={back} /> : <ProjectList onOpen={open} />}</main>
      )}
    </div>
  );
}
