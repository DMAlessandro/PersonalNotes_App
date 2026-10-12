import { describe, expect, it } from 'vitest';
import { findAnswers, answerMessage } from './answers';
import { addReplies } from './claudeSessions';
import { addItem } from '../domain/edits';
import { crossOut } from '../domain/lifecycle';
import { emptyData } from '../domain/model';

const T1 = '2026-10-12T18:00:00.000+02:00';
const T2 = '2026-10-12T18:05:00.000+02:00';
let n = 0;
const ids = (p: 'p' | 'i') => `${p}_a${++n}`;

function setup() {
  const r = addReplies(emptyData(), [{ sid: 'A', title: 'App · A', text: 'reply 1' }, { sid: 'B', title: 'App · B', text: 'b' }], {}, T1, ids);
  const doc = Object.values(r.data.docs)[0];
  const pid = doc.project.id;
  const replyId = Object.values(doc.items).find((i) => i.text === 'reply 1')!.id;
  const bReply = Object.values(doc.items).find((i) => i.text === 'b')!.id;
  return { data: r.data, pid, task: r.sessions.A, replyId, bReply };
}

describe('findAnswers (Claude Sessions bridge, answering from the phone)', () => {
  it('finds Notes written under a reply or under the session Task, oldest first', () => {
    const s = setup();
    let d = addItem(s.data, s.pid, { id: 'n2', type: 'note', text: 'second', parent: s.task }, T2);
    d = addItem(d, s.pid, { id: 'n1', type: 'note', text: 'first', parent: s.replyId }, T1);
    expect(findAnswers(d.docs[s.pid], s.task, []).map((i) => i.text)).toEqual(['first', 'second']);
  });

  it('ignores the replies themselves, other sessions, answered Notes and crossed-out Notes', () => {
    const s = setup();
    let d = addItem(s.data, s.pid, { id: 'nb', type: 'note', text: 'for B', parent: s.bReply }, T2);
    d = addItem(d, s.pid, { id: 'old', type: 'note', text: 'already sent', parent: s.replyId }, T2);
    d = addItem(d, s.pid, { id: 'x', type: 'note', text: 'never mind', parent: s.replyId }, T2);
    d = crossOut(d, s.pid, 'x', T2, 'Phone');
    expect(findAnswers(d.docs[s.pid], s.task, ['old'])).toEqual([]);
  });

  it('skips empty Notes (still being typed when Pushed)', () => {
    const s = setup();
    const d = addItem(s.data, s.pid, { id: 'e', type: 'note', text: '  ', parent: s.replyId }, T2);
    expect(findAnswers(d.docs[s.pid], s.task, [])).toEqual([]);
  });
});

describe('answerMessage', () => {
  it('joins the answers and reads #phoneoff as "stop sending"', () => {
    expect(answerMessage(['yes, go on'])).toEqual({ text: 'yes, go on', off: false });
    expect(answerMessage(['do A', 'then B'])).toEqual({ text: 'do A\n\nthen B', off: false });
    expect(answerMessage(['#phoneoff ok, I am back'])).toEqual({ text: 'ok, I am back', off: true });
    expect(answerMessage(['#PHONEOFF'])).toEqual({ text: '', off: true });
  });
});
