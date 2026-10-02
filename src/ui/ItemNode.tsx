import { useState, type PointerEvent } from 'react';
import type { Item, ProjectDoc } from '../domain/model';
import { children, progress } from '../domain/ordering';
import {
  addItem, canIndent, canOutdent, discardItem, editText, indent, makeTask, moveItem, outdent, setFolded,
} from '../domain/edits';
import { newId } from '../domain/ids';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { DueChip, Linkified, shortDate } from './format';
import { Menu, Panel } from './Panel';
import { TextEditor } from './TextEditor';
import { DueSheet } from './DueSheet';
import { useDrag } from './useDrag';
import { useLongPress } from './useLongPress';
import { Confirm } from './Confirm';
import { crossOut, deleteItem, sendToBottom, uncross } from '../domain/lifecycle';
import { deviceName } from '../store/device';

export const groupOf = (pid: string, parent: string | null) => `items:${pid}:${parent ?? 'root'}`;

function countDescendants(doc: ProjectDoc, id: string): number {
  return children(doc, id).reduce((n, c) => n + 1 + countDescendants(doc, c.id), 0);
}

type Props = {
  doc: ProjectDoc;
  item: Item;
  depth: number;
  dragHandle: (id: string) => (e: PointerEvent<HTMLElement>) => void;
};

/** One Item and its branch. At depth 0 it is a card (spec §5.2); deeper it is an indented row with a guide line. */
export function ItemNode({ doc, item, depth, dragHandle }: Props) {
  const pid = doc.project.id;
  const apply = useStore((s) => s.apply);
  const { editing, fresh, startEditing, stopEditing } = useUi();
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [dueOpen, setDueOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const longPress = useLongPress((el) => setMenu(el.getBoundingClientRect()));
  const kids = children(doc, item.id);
  const prog = progress(doc, item.id);
  const isEditing = editing === `item:${item.id}`;
  const isTask = item.type === 'task';
  const childDrag = useDrag(
    groupOf(pid, item.id),
    (id, index) => apply((d, now) => moveItem(d, pid, id, index, now)),
  );

  const addUnder = (type: 'task' | 'note') => {
    const id = newId('i');
    apply((d, now) => {
      const opened = item.folded ? setFolded(d, pid, item.id, false, now) : d;
      return addItem(opened, pid, { id, type, text: '', parent: item.id }, now);
    });
    startEditing(`item:${id}`, id);
  };

  const finishEdit = (text: string) => {
    const isFresh = fresh.has(item.id);
    stopEditing(item.id);
    if (!text.trim()) {
      if (isFresh) apply((d) => discardItem(d, pid, item.id));
      return;
    }
    if (text !== item.text) apply((d, now) => editText(d, pid, item.id, text, now));
  };

  const cancelEdit = () => {
    const isFresh = fresh.has(item.id);
    stopEditing(item.id);
    if (isFresh && !item.text) apply((d) => discardItem(d, pid, item.id));
  };

  const tabEdit = (text: string, shift: boolean) => {
    finishEdit(text);
    if (!text.trim()) return;
    apply((d, now) => {
      const cur = d.docs[pid];
      if (shift) return canOutdent(cur, item.id) ? outdent(d, pid, item.id, now) : d;
      return canIndent(cur, item.id) ? indent(d, pid, item.id, now) : d;
    });
    startEditing(`item:${item.id}`);
  };

  const toggleCross = () =>
    apply((d, now) => (item.crossed ? uncross(d, pid, item.id, now) : crossOut(d, pid, item.id, now, deviceName())));

  const dates = [
    `created ${shortDate(item.created)}`,
    item.edited.slice(0, 10) !== item.created.slice(0, 10) && `edited ${shortDate(item.edited)}`,
    item.crossedAt && `crossed out ${shortDate(item.crossedAt)}`,
  ].filter(Boolean);
  const under = countDescendants(doc, item.id);

  const row = (
    <div className="row" {...(isEditing ? {} : longPress)}>
      <button className="handle" aria-label="Drag to reorder" onPointerDown={dragHandle(item.id)}>
        ⠿
      </button>
      {kids.length > 0 ? (
        <button
          className="fold"
          aria-label={item.folded ? 'Unfold' : 'Fold'}
          aria-expanded={!item.folded}
          onClick={() => apply((d, now) => setFolded(d, pid, item.id, !item.folded, now))}
        >
          {item.folded ? '▸' : '▾'}
        </button>
      ) : (
        <span className="fold" />
      )}
      {isTask ? (
        <input
          type="checkbox"
          className="tick"
          checked={item.crossed}
          aria-label={item.crossed ? 'Un-tick' : 'Tick'}
          onChange={toggleCross}
        />
      ) : (
        <span className="note-mark" aria-hidden="true" />
      )}
      <div className="body">
        {isEditing ? (
          <TextEditor
            initial={item.text}
            placeholder={isTask ? 'Task' : 'Note'}
            onDone={finishEdit}
            onCancel={cancelEdit}
            onTab={tabEdit}
          />
        ) : (
          <div className="text" onDoubleClick={() => startEditing(`item:${item.id}`)}>
            <Linkified text={item.text} />
          </div>
        )}
        <div className="meta">
          {item.due && <DueChip due={item.due} muted={item.crossed} />}
          {prog && <span className="count">{`${prog.done}/${prog.total}`}</span>}
          {item.folded && kids.length > 0 && <span className="count">{`+${under}`}</span>}
          <span className="dates">{dates.join(' · ')}</span>
        </div>
      </div>
      {item.crossed && !item.bottomed && (
        <button
          className="to-bottom"
          title="Move to the bottom of this level"
          onClick={() => apply((d, now) => sendToBottom(d, pid, item.id, now))}
        >
          ↓ bottom
        </button>
      )}
      <button className="more" aria-label="Item menu" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
        ⋯
      </button>
    </div>
  );

  return (
    <div
      className={`${depth === 0 ? 'card' : 'node'} ${isTask ? 'task' : 'note'}${item.crossed ? ' crossed' : ''}`}
      data-drag-group={groupOf(pid, item.parent)}
      data-drag-id={item.id}
      style={{ ['--depth' as string]: depth }}
    >
      {row}
      {depth === 0 && prog && (
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${(100 * prog.done) / prog.total}%` }} />
        </div>
      )}
      {!item.folded && kids.length > 0 && (
        <div className={depth >= 4 ? 'kids flat' : 'kids'}>
          {kids.map((k) => (
            <ItemNode key={k.id} doc={doc} item={k} depth={depth + 1} dragHandle={childDrag} />
          ))}
        </div>
      )}
      {menu && (
        <Panel anchor={menu} onClose={() => setMenu(null)} label="Item menu">
          <Menu
            onClose={() => setMenu(null)}
            entries={[
              isTask && { label: 'Add Task under', onSelect: () => addUnder('task') },
              isTask && { label: 'Add Note under', onSelect: () => addUnder('note') },
              { label: 'Edit', onSelect: () => startEditing(`item:${item.id}`) },
              isTask && { label: item.due ? 'Change due date' : 'Set due date', onSelect: () => setDueOpen(true) },
              !isTask && { label: 'Make Task', onSelect: () => apply((d, now) => makeTask(d, pid, item.id, now)) },
              canIndent(doc, item.id) && { label: 'Indent', onSelect: () => apply((d, now) => indent(d, pid, item.id, now)) },
              canOutdent(doc, item.id) && { label: 'Outdent', onSelect: () => apply((d, now) => outdent(d, pid, item.id, now)) },
              { label: item.crossed ? 'Un-cross' : 'Cross out', onSelect: toggleCross },
              item.crossed && !item.bottomed && { label: '↓ Move to bottom', onSelect: () => apply((d, now) => sendToBottom(d, pid, item.id, now)) },
              item.crossed && { label: 'Delete…', danger: true, onSelect: () => setConfirmDelete(true) },
            ]}
          />
        </Panel>
      )}
      {dueOpen && <DueSheet pid={pid} item={item} onClose={() => setDueOpen(false)} />}
      {confirmDelete && (
        <Confirm
          title={`Delete "${item.text.split('\n')[0]}"?`}
          body={`${under ? `This also deletes the ${under === 1 ? 'Item' : `${under} Items`} under it. ` : ''}You can restore it from the Change log.`}
          confirmLabel="Delete"
          onConfirm={() => apply((d, now) => deleteItem(d, pid, item.id, now, deviceName()))}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
