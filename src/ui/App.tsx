import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { isConfigured, useSync } from '../store/sync';
import { useUi } from '../store/ui';
import type { Item } from '../domain/model';
import { groupOf } from './ItemNode';
import { ChangeLog } from './ChangeLog';
import { ProjectList } from './ProjectList';
import { ProjectView } from './ProjectView';
import { Settings } from './Settings';
import { FirstConnectChoice, Toast, useUnpushed } from './SyncUi';
import { Resolver } from './Resolver';
import { useUpdate } from '../store/update';
import { TopBar, type ViewMode } from './TopBar';
import { useWide } from './useWide';
import { useOnline } from './useOnline';
import { Search } from './Search';
import { MapView } from './MapView';
import { useLaptopShortcuts } from './shortcuts';
import { Workspaces } from './Workspaces';
import { reveal } from '../domain/edits';
import type { SearchResult } from '../domain/search';
import { shownProjectIds, sortedWorkspaces } from '../domain/workspaces';

type HistoryState = { project?: string; log?: string; settings?: boolean; search?: boolean; workspaces?: boolean } | null;

export function App() {
  const [view, setView] = useState<ViewMode>('list');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const { loaded, load, saveError, apply } = useStore();
  const { openProject, setOpenProject, log, setLog, workspace, setWorkspace, setFlash } = useUi();
  const index = useStore((s) => s.data.index);
  const workspaces = useMemo(() => sortedWorkspaces({ index, docs: {}, log: {} }), [index]);
  const exists = useStore((s) => (openProject ? !!s.data.docs[openProject] : false));
  const sync = useSync();
  const configured = useMemo(isConfigured, [sync.configVersion]);
  const unpushed = useUnpushed();
  const wide = useWide();
  const update = useUpdate();
  const online = useOnline();

  useEffect(() => {
    void load();
    void sync.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spec §6.1: Pull when the app opens and whenever it comes back to the foreground. No background polling.
  useEffect(() => {
    if (loaded && sync.baseLoaded && configured && navigator.onLine) void sync.pullNow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, sync.baseLoaded, configured]);
  // Offline: skip these automatic Pulls (they would only fail), and Pull quietly when the connection is back.
  useEffect(() => {
    const quietPull = () => navigator.onLine && isConfigured() && void useSync.getState().pullNow(true);
    const onVisible = () => document.visibilityState === 'visible' && quietPull();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', quietPull);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', quietPull);
    };
  }, []);

  // Opening a Project (phone), a Change log or Settings is a history step, so Android's back gesture closes it.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as HistoryState;
      setLog(st?.log ? { pid: st.log === '*' ? null : st.log } : null);
      setSettingsOpen(!!st?.settings);
      setSearchOpen(!!st?.search);
      setWorkspacesOpen(!!st?.workspaces);
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

  const openSearch = () => {
    history.pushState({ ...(history.state ?? {}), search: true }, '');
    setSearchOpen(true);
  };
  const closeSearch = () => (history.state?.search ? history.back() : setSearchOpen(false));
  const openWorkspaces = () => {
    history.pushState({ ...(history.state ?? {}), workspaces: true }, '');
    setWorkspacesOpen(true);
  };
  const closeWorkspaces = () => (history.state?.workspaces ? history.back() : setWorkspacesOpen(false));

  // A Workspace deleted (here or on the other device) falls back to All Projects.
  useEffect(() => {
    if (workspace && !index.workspaces[workspace]) setWorkspace(null);
  }, [index, workspace, setWorkspace]);

  // Picking a Workspace filters everything (ticket 02): an open Project outside it is closed.
  const pickWorkspace = (wid: string | null) => {
    setWorkspace(wid);
    const cur = useUi.getState().openProject;
    if (cur && !shownProjectIds(useStore.getState().data, wid).includes(cur)) {
      if (!wide && history.state?.project) history.back();
      else setOpenProject(null);
    }
  };

  // Search jump (spec §5.4): open the Project, unfold the path, scroll to the Item and highlight it.
  // A result under Other Projects switches to All Projects so the Project is in the list.
  // Ticket 14: open every crossed-out section on the way to the Item, and the Projects one if the Project is crossed.
  const showCrossedPath = (pid: string, id: string) => {
    const d = useStore.getState().data.docs[pid];
    const keys: string[] = d?.project.crossed ? ['projects'] : [];
    for (let it: Item | undefined = d?.items[id]; it; it = it.parent ? d.items[it.parent] : undefined) {
      if (it.crossed) keys.push(groupOf(pid, it.parent));
    }
    useUi.getState().showCrossed(keys);
  };

  const jump = (r: SearchResult) => {
    const st: Record<string, unknown> = { ...(history.state ?? {}) };
    delete st.search;
    if (!wide) st.project = r.pid;
    if (history.state?.search) history.replaceState(st, '');
    else if (!wide && !openProject) history.pushState(st, '');
    setSearchOpen(false);
    if (workspace && !index.workspaces[workspace]?.projects.includes(r.pid)) setWorkspace(null);
    apply((d, now) => reveal(d, r.pid, r.item.id, now));
    setOpenProject(r.pid);
    showCrossedPath(r.pid, r.item.id);
    setFlash(r.item.id);
  };

  const current = openProject && exists ? openProject : null;
  useLaptopShortcuts(view === 'list' ? current : null, !!log || settingsOpen || workspacesOpen || searchOpen || sync.resolverOpen);

  return (
    <div className="app">
      <TopBar
        view={view}
        onViewChange={setView}
        unpushed={unpushed}
        online={online}
        hasToken={configured}
        busy={sync.busy}
        onOpenLog={() => openLog(null)}
        onOpenSettings={openSettings}
        onPush={() => void sync.pushNow()}
        onRefresh={() => void sync.pullNow()}
        workspaces={workspaces}
        workspace={workspace}
        onWorkspace={pickWorkspace}
        onOpenWorkspaces={openWorkspaces}
        onSearch={openSearch}
      />
      {update.ready && (
        <div className="banner update">
          A new version of the app is ready.
          <button className="secondary small" onClick={update.apply}>
            Reload
          </button>
        </div>
      )}
      {saveError && <div className="banner error">{saveError}</div>}
      {sync.clashes.length > 0 && !sync.resolverOpen && (
        <div className="banner warn">
          {sync.clashes.length === 1 ? '1 clash' : `${sync.clashes.length} clashes`} to settle before the next Push.
          <button className="secondary small" onClick={() => sync.setResolverOpen(true)}>
            Settle
          </button>
        </div>
      )}
      {!loaded ? (
        <main className="empty" />
      ) : view === 'map' ? (
        <MapView />
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
      {workspacesOpen && <Workspaces onClose={closeWorkspaces} />}
      {searchOpen && <Search onClose={closeSearch} onJump={jump} />}
      <FirstConnectChoice />
      <Resolver />
      <Toast onSettings={openSettings} />
    </div>
  );
}
