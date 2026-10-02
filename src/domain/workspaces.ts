// Ticket 02 / spec §4.4: Workspaces are named selections of Projects, kept in index.json.
// The built-in All Projects is not stored: it is `null` here. Deleting a Workspace is not logged.
import type { AppData, Timestamp, Workspace } from './model';
import { sortedProjectIds } from './ordering';

function withWorkspace(data: AppData, wid: string, fn: (w: Workspace) => Workspace): AppData {
  const w = data.index.workspaces[wid];
  if (!w) throw new Error(`No Workspace ${wid}`);
  return { ...data, index: { ...data.index, workspaces: { ...data.index.workspaces, [wid]: fn(w) } } };
}

function cleanName(name: string): string {
  const n = name.trim();
  if (!n) throw new Error('A Workspace needs a name');
  return n;
}

export function addWorkspace(data: AppData, w: { id: string; name: string }, now: Timestamp): AppData {
  const ws: Workspace = { name: cleanName(w.name), projects: [], at: now };
  return { ...data, index: { ...data.index, workspaces: { ...data.index.workspaces, [w.id]: ws } } };
}

export function renameWorkspace(data: AppData, wid: string, name: string, now: Timestamp): AppData {
  const n = cleanName(name);
  return withWorkspace(data, wid, (w) => ({ ...w, name: n, at: now }));
}

export function deleteWorkspace(data: AppData, wid: string): AppData {
  const { [wid]: _gone, ...workspaces } = data.index.workspaces;
  return { ...data, index: { ...data.index, workspaces } };
}

/** Put a Project in a Workspace or take it out (from the Project's menu or the Workspace's settings). */
export function setMember(data: AppData, wid: string, pid: string, member: boolean, now: Timestamp): AppData {
  const w = data.index.workspaces[wid];
  if (!w || w.projects.includes(pid) === member) return data;
  return withWorkspace(data, wid, (x) => ({
    ...x,
    projects: member ? [...x.projects, pid] : x.projects.filter((p) => p !== pid),
    at: now,
  }));
}

export function projectWorkspaces(data: AppData, pid: string): string[] {
  return Object.entries(data.index.workspaces)
    .filter(([, w]) => w.projects.includes(pid))
    .map(([id]) => id);
}

/** The Projects a Workspace shows (null = All Projects), in the one manual Project order. */
export function shownProjectIds(data: AppData, wid: string | null): string[] {
  const all = sortedProjectIds(data);
  const w = wid ? data.index.workspaces[wid] : undefined;
  return w ? all.filter((pid) => w.projects.includes(pid)) : all;
}

export function sortedWorkspaces(data: AppData): ({ id: string } & Workspace)[] {
  return Object.entries(data.index.workspaces)
    .map(([id, w]) => ({ id, ...w }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}
