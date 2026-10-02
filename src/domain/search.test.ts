import { describe, expect, it } from 'vitest';
import { search } from './search';
import { data, doc, item } from './testkit';
import { addWorkspace } from './workspaces';
import { setMember } from './workspaces';

const NOW = '2026-10-02T09:00:00+02:00';

/** p (in Workspace w): Task "Draft intro" > Note "intro ideas", Task "Budget" (crossed) > Task "Intro to budget".
 *  q (not in w): Task "Write INTRO" due 10-20, Task "Other". */
function fixture() {
  const d = data(
    [
      doc('p', [
        item('t1', { text: 'Draft intro', order: 'a' }),
        item('n1', { type: 'note', text: 'intro ideas', parent: 't1', order: 'a' }),
        item('t2', { text: 'Budget', order: 'b', crossed: true }),
        item('t3', { text: 'Intro to budget', parent: 't2', order: 'a', due: '2026-10-12', crossed: true }),
      ]),
      doc('q', [item('u1', { text: 'Write INTRO', due: '2026-10-20', order: 'a' }), item('u2', { text: 'Other', order: 'b' })]),
    ],
    { p: 'a', q: 'b' },
  );
  return setMember(addWorkspace(d, { id: 'w', name: 'W' }, NOW), 'w', 'p', true, NOW);
}

const ids = (rs: { item: { id: string } }[]) => rs.map((r) => r.item.id);

describe('search', () => {
  it('matches Item text, case-insensitive, across all Projects; Project names are not searched', () => {
    const r = search(fixture(), 'INTRO', { workspace: null, dueOnly: false });
    expect(ids(r.here)).toEqual(['t1', 'n1', 'u1', 't3']);
    expect(r.other).toEqual([]);
    expect(ids(search(fixture(), 'q', { workspace: null, dueOnly: false }).here)).toEqual([]);
  });

  it('lists the current Workspace first, then Other Projects; open before crossed out', () => {
    const r = search(fixture(), 'intro', { workspace: 'w', dueOnly: false });
    expect(ids(r.here)).toEqual(['t1', 'n1', 't3']);
    expect(ids(r.other)).toEqual(['u1']);
  });

  it('gives each result its parent path and Project', () => {
    const r = search(fixture(), 'ideas', { workspace: null, dueOnly: false });
    expect(r.here[0]).toMatchObject({ pid: 'p', projectTitle: 'p', path: ['Draft intro'] });
  });

  it('"Has due date" keeps only dated Tasks, nearest first, open before crossed out', () => {
    const r = search(fixture(), 'intro', { workspace: null, dueOnly: true });
    expect(ids(r.here)).toEqual(['u1', 't3']);
  });

  it('an empty query finds nothing', () => {
    expect(search(fixture(), '  ', { workspace: null, dueOnly: true }).here).toEqual([]);
  });
});
