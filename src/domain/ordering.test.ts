import { describe, expect, it } from 'vitest';
import { children, progress, projectDeadline, projectSortDate, sortedProjectIds, openTaskCount } from './ordering';
import { data, doc, item } from './testkit';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('sibling order (spec §4.1)', () => {
  it('puts dated Items first (nearest on top), then the rest by manual order', () => {
    const d = doc('p', [
      item('plain2', { order: 'b' }),
      item('later', { due: '2026-10-20', order: 'a' }),
      item('plain1', { order: 'a' }),
      item('sooner', { due: '2026-10-05', order: 'z' }),
    ]);
    expect(ids(children(d, null))).toEqual(['sooner', 'later', 'plain1', 'plain2']);
  });

  it('breaks a due-date tie by manual order', () => {
    const d = doc('p', [item('b', { due: '2026-10-05', order: 'b' }), item('a', { due: '2026-10-05', order: 'a' })]);
    expect(ids(children(d, null))).toEqual(['a', 'b']);
  });

  it('keeps a crossed-out dated Item in the dated group: crossing out never moves anything', () => {
    const d = doc('p', [
      item('plain', { order: 'a' }),
      item('done', { due: '2026-10-01', crossed: true, order: 'z' }),
      item('open', { due: '2026-10-09', order: 'b' }),
    ]);
    expect(ids(children(d, null))).toEqual(['done', 'open', 'plain']);
  });

  it('puts Items sent to the bottom last, even when dated', () => {
    const d = doc('p', [
      item('sent', { due: '2026-10-01', crossed: true, bottomed: true, order: 'a' }),
      item('plain', { order: 'b' }),
      item('dated', { due: '2026-11-01', order: 'c' }),
    ]);
    expect(ids(children(d, null))).toEqual(['dated', 'plain', 'sent']);
  });

  it('ignores the due date of Notes (only Tasks have one)', () => {
    const d = doc('p', [
      item('t', { order: 'a' }),
      item('n', { type: 'note', parent: 't', due: '2026-10-01', order: 'b' }),
      item('m', { type: 'note', parent: 't', order: 'a' }),
    ]);
    expect(ids(children(d, 't'))).toEqual(['m', 'n']);
  });

  it('orders each level on its own', () => {
    const d = doc('p', [
      item('top', { order: 'a' }),
      item('c2', { parent: 'top', order: 'a' }),
      item('c1', { parent: 'top', due: '2026-12-01', order: 'b' }),
    ]);
    expect(ids(children(d, null))).toEqual(['top']);
    expect(ids(children(d, 'top'))).toEqual(['c1', 'c2']);
  });
});

describe('Project deadline and sort date (spec §2.2)', () => {
  const d = doc('p', [
    item('t1', { due: '2026-10-03', crossed: true }),
    item('t2', { due: '2026-10-08' }),
    item('t3', { parent: 't2', due: '2026-10-06' }),
    item('gone', { due: '2026-09-01', crossed: true, bottomed: true }),
    item('under-gone', { parent: 'gone', due: '2026-08-01', crossed: true }),
  ]);

  it('deadline chip = earliest open Task due date at any depth', () => {
    expect(projectDeadline(d)).toBe('2026-10-06');
  });

  it('sort date = earliest of all dated Tasks, ticked or not, skipping branches sent to the bottom', () => {
    expect(projectSortDate(d)).toBe('2026-10-03');
  });

  it('a Project with no dates has neither', () => {
    expect(projectDeadline(doc('q', [item('x')]))).toBeNull();
    expect(projectSortDate(doc('q', [item('x')]))).toBeNull();
  });
});

describe('Project order', () => {
  it('dated Projects first by sort date, then manual order, then Projects sent to the bottom', () => {
    const app = data(
      [
        doc('manualB'),
        doc('dated', [item('x', { due: '2026-10-10' })]),
        doc('manualA'),
        doc({ ...doc('sent').project, crossed: true, bottomed: true }, [item('y', { due: '2026-10-01' })]),
        doc('soon', [item('z', { due: '2026-10-04', crossed: true })]),
      ],
      { manualB: 'b', dated: 'c', manualA: 'a', sent: 'A', soon: 'z' },
    );
    expect(sortedProjectIds(app)).toEqual(['soon', 'dated', 'manualA', 'manualB', 'sent']);
  });
});

describe('progress and counts', () => {
  it('counts crossed direct children over all direct children', () => {
    const d = doc('p', [
      item('t'),
      item('a', { parent: 't', crossed: true }),
      item('b', { parent: 't' }),
      item('n', { parent: 't', type: 'note' }),
      item('deep', { parent: 'b', crossed: true }),
    ]);
    expect(progress(d, 't')).toEqual({ done: 1, total: 3 });
    expect(progress(d, 'a')).toBeNull();
  });

  it('counts open Tasks in a Project', () => {
    const d = doc('p', [item('a'), item('b', { crossed: true }), item('n', { type: 'note', parent: 'a' }), item('c', { parent: 'a' })]);
    expect(openTaskCount(d)).toBe(2);
  });
});
