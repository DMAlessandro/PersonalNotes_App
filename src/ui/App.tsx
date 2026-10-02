import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { isConfigured, useSync } from '../store/sync';
import { useUi } from '../store/ui';
import { ChangeLog } from './ChangeLog';
import { ProjectList } from './ProjectList';
import { ProjectView } from './ProjectView';
import { Settings } from './Settings';
import { FirstConnectChoice, Toast, useUnpushed } from './SyncUi';
import { TopBar, type ViewMode } from './TopBar';
import { useWide } from './useWide';

type HistoryState = { project?: string; log?: string; settings?: boolean } | null;

export function App() {
  const [view, setView] = useState<ViewMode>('list');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { loaded, load, saveError } = useStore();
  const { openProject, setOpenProject, log, setLog } = useUi();
  const exists = useStore((s) => (openProject ? !!s.data.docs[openProject] : false));
  const sync = useSync();
  const configured = useMemo(isConfigured, [sync.configVersion]);
  const unpushed = useUnpushed();
  const wide = useWide();

  useEffect(() => {
    void load();
    void sync.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spec §6.1: Pull when the app opens and whenever it comes back to the foreground. No background polling.
  useEffect(() => {
    if (loaded && sync.baseLoaded && configured) void sync.pullNow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, sync.baseLoaded, configured]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void useSync.getState().pullNow(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Opening a Project (phone), a Change log or Settings is a history step, so Android's back gesture closes it.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as HistoryState;
      setLog(st?.log ? { pid: st.log === '*' ? null : st.log } : null);
      setSettingsOpen(!!st?.settings);
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
  const openSettings = () => {
    history.pushState({ ...(history.state ?? {}), settings: true }, '');
    setSettingsOpen(true);
  };
  const closeSettings = () => (history.state?.settings ? history.back() : setSettingsOpen(false));

  const current = openProject && exists ? openProject : null;

  return (
    <div className="app">
      <TopBar
        view={view}
        onViewChange={setView}
        unpushed={unpushed}
        hasToken={configured}
        busy={sync.busy}
        onOpenLog={() => openLog(null)}
        onOpenSettings={openSettings}
        onPush={() => void sync.pushNow()}
        onRefresh={() => void sync.pullNow()}
      />
      {saveError && <div className="banner error">{saveError}</div>}
      {sync.blocked && (
        <div className="banner warn">
          The other device pushed changes while this one has unpushed edits. Merging arrives in the next build step; your edits
          here are safe.
        </div>
      )}
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
        <main className="single">
          {current ? <ProjectView pid={current} onBack={back} onOpenLog={() => openLog(current)} /> : <ProjectList onOpen={open} />}
        </main>
      )}
      {log && <ChangeLog pid={log.pid} onClose={closeLog} />}
      {settingsOpen && <Settings onClose={closeSettings} />}
      <FirstConnectChoice />
      <Toast />
    </div>
  );
}
