import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { ProjectList } from './ProjectList';
import { ProjectView } from './ProjectView';
import { TopBar, type ViewMode } from './TopBar';
import { useWide } from './useWide';
import { ChangeLog } from './ChangeLog';

export function App() {
  const [view, setView] = useState<ViewMode>('list');
  const { loaded, load, saveError } = useStore();
  const { openProject, setOpenProject, log, setLog } = useUi();
  const exists = useStore((s) => (openProject ? !!s.data.docs[openProject] : false));
  const wide = useWide();

  useEffect(() => {
    void load();
  }, [load]);

  // Opening a Project (phone) or a Change log is a history step, so Android's back gesture closes it.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { project?: string; log?: string } | null;
      setLog(st?.log ? { pid: st.log === '*' ? null : st.log } : null);
      if (!wide) setOpenProject(st?.project ?? null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setOpenProject, setLog, wide]);

  const open = (pid: string) => {
    if (!wide && !openProject) history.pushState({ project: pid }, '');
    setOpenProject(pid);
  };
  const back = () => (history.state?.project ? history.back() : setOpenProject(null));
  const openLog = (pid: string | null) => {
    history.pushState({ ...(history.state ?? {}), log: pid ?? '*' }, '');
    setLog({ pid });
  };
  const closeLog = () => (history.state?.log ? history.back() : setLog(null));

  const current = openProject && exists ? openProject : null;

  return (
    <div className="app">
      <TopBar view={view} onViewChange={setView} unpushed={0} hasToken={false} onOpenLog={() => openLog(null)} />
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
            <ProjectView pid={current} onOpenLog={() => openLog(current)} />
          ) : (
            <div className="empty">
              <p className="empty-hint">Pick a Project, or add one.</p>
            </div>
          )}
        </main>
      ) : (
        <main className="single">{current ? <ProjectView pid={current} onBack={back} onOpenLog={() => openLog(current)} /> : <ProjectList onOpen={open} />}</main>
      )}
      {log && <ChangeLog pid={log.pid} onClose={closeLog} />}
    </div>
  );
}
