import { describe, expect, it } from 'vitest';
import { addProject, moveProject } from './edits';
import { emptyData } from './model';
import { sortedProjectIds } from './ordering';
import { data, doc } from './testkit';
import {
  addWorkspace, deleteWorkspace, projectWorkspaces, renameWorkspace, setMember, shownProjectIds, sortedWorkspaces,
} from './workspaces';

const NOW = '2026-10-02T09:00:00+02:00';

describe('Workspaces', () => {
  const base = () => addWorkspace(data([doc('a'), doc('b'), doc('c')], { a: 'a', b: 'b', c: 'c' }), { id: 'w', name: 'Research' }, NOW);

  it('adds, renames and deletes a Workspace; deleting leaves its Projects alone', () => {
    let d = base();
    expect(d.index.workspaces.w).toEqual({ name: 'Research', projects: [], at: NOW });
    d = renameWorkspace(d, 'w', 'Lab', '2026-10-02T10:00:00+02:00');
    expect(d.index.workspaces.w).toMatchObject({ name: 'Lab', at: '2026-10-02T10:00:00+02:00' });
    d = setMember(d, 'w', 'a', true, NOW);
    d = deleteWorkspace(d, 'w');
    expect(d.index.workspaces.w).toBeUndefined();
    expect(Object.keys(d.docs)).toEqual(['a', 'b', 'c']);
  });

  it('refuses an empty name', () => {
    expect(() => addWorkspace(emptyData(), { id: 'w', name: '  ' }, NOW)).toThrow();
    expect(() => renameWorkspace(base(), 'w', '', NOW)).toThrow();
  });

  it('adds and removes members, once each, from either side', () => {
    let d = setMember(base(), 'w', 'b', true, NOW);
    d = setMember(d, 'w', 'b', true, NOW);
    d = setMember(d, 'w', 'a', true, NOW);
    expect(d.index.workspaces.w.projects).toEqual(['b', 'a']);
    expect(projectWorkspaces(d, 'a')).toEqual(['w']);
    d = setMember(d, 'w', 'b', false, NOW);
    expect(d.index.workspaces.w.projects).toEqual(['a']);
    expect(projectWorkspaces(d, 'b')).toEqual([]);
  });

  it('shows a Workspace in the one manual Project order; null = All Projects', () => {
    let d = setMember(base(), 'w', 'c', true, NOW);
    d = setMember(d, 'w', 'a', true, NOW);
    expect(shownProjectIds(d, 'w')).toEqual(['a', 'c']);
    expect(shownProjectIds(d, null)).toEqual(['a', 'b', 'c']);
  });

  it('lists Workspaces by name', () => {
    let d = addWorkspace(base(), { id: 'w2', name: 'admin' }, NOW);
    d = addWorkspace(d, { id: 'w3', name: 'Teaching' }, NOW);
    expect(sortedWorkspaces(d).map((w) => w.id)).toEqual(['w2', 'w', 'w3']);
  });

  it('a new Project joins the current Workspace', () => {
    const d = addProject(base(), { id: 'n', title: 'New' }, NOW, 'w');
    expect(d.index.workspaces.w.projects).toEqual(['n']);
    expect(addProject(base(), { id: 'n', title: 'New' }, NOW).index.workspaces.w.projects).toEqual([]);
  });

  it('dragging inside a Workspace moves the Project among the ones shown', () => {
    let d = setMember(base(), 'w', 'a', true, NOW);
    d = setMember(d, 'w', 'c', true, NOW);
    // Shown: a, c. Drag c to the top.
    d = moveProject(d, 'c', 0, NOW, shownProjectIds(d, 'w'));
    expect(shownProjectIds(d, 'w')).toEqual(['c', 'a']);
    expect(sortedProjectIds(d)).toEqual(['c', 'a', 'b']);
    // Drag c below a: it lands just after a, before the hidden b.
    d = moveProject(d, 'c', 1, NOW, shownProjectIds(d, 'w'));
    expect(sortedProjectIds(d)).toEqual(['a', 'c', 'b']);
    const keys = Object.values(d.index.projectOrder).map((o) => o.order);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
