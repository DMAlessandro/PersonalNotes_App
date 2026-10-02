import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { _resetForTests, loadData, saveChanges } from './db';
import { addItem, addProject, editText } from '../domain/edits';
import { emptyData } from '../domain/model';

const NOW = '2026-10-02T09:00:00+02:00';

describe('local Save', () => {
  it('starts empty, then reloads exactly what was saved, including removals', async () => {
    expect(await loadData()).toEqual(emptyData());

    const a = addProject(emptyData(), { id: 'p1', title: 'One' }, NOW);
    const b = addItem(addProject(a, { id: 'p2', title: 'Two' }, NOW), 'p1', { id: 'i1', type: 'task', text: 'x', parent: null }, NOW);
    await saveChanges(emptyData(), b);
    const c = editText(b, 'p1', 'i1', 'changed', NOW);
    await saveChanges(b, c);

    _resetForTests();
    expect(await loadData()).toEqual(c);

    const { p2: _gone, ...docs } = c.docs;
    const d = { ...c, docs };
    await saveChanges(c, d);
    _resetForTests();
    expect(Object.keys((await loadData()).docs)).toEqual(['p1']);
  });
});
