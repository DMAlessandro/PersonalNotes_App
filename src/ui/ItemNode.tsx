import { useEffect, useRef, type PointerEvent } from 'react';
import type { Item, ProjectDoc } from '../domain/model';
import { children, progress, splitCrossed } from '../domain/ordering';
import { moveItem, setFolded } from '../domain/edits';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { DueChip, Linkified, shortDate } from './format';
import { TextEditor } from './TextEditor';
import { useDrag } from './useDrag';
import { useLongPress } from './useLongPress';
import { countDescendants, useItemEditing, useItemMenu } from './itemActions';
import { selectOnMouse } from './shortcuts';
import { CrossedSection } from './CrossedSection';

export const groupOf = (pid: string, parent: string | null) => `items:${pid}:${parent ?? 'root'}`;

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
  const { isEditing, startEdit, finishEdit, cancelEdit, tabEdit, ctrlEnterEdit } = useItemEditing(pid, item);
  const selected = useUi((s) => s.selected?.id === item.id);
  const menu = useItemMenu(doc, item);
  const flash = useUi((s) => s.flash === item.id);
  const rowRef = useRef<HTMLDivElement>(null);
  const longPress = useLongPress((el) => menu.open(el.getBoundingClientRect()));
  const kids = children(doc, item.id);
  const split = splitCrossed(kids);
  const prog = progress(doc, item.id);
  const isTask = item.type === 'task';
  const childDrag = useDrag(
    groupOf(pid, item.id),
    (id, index) => apply((d, now) => moveItem(d, pid, id, index, now)),
  );

  // Search jump: bring the Item into view and highlight it briefly (spec §5.4).
  useEffect(() => {
    if (!flash) return;
    rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = window.setTimeout(() => useUi.getState().setFlash(null), 2000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const dates = [
    `created ${shortDate(item.created)}`,
    item.edited.slice(0, 10) !== item.created.slice(0, 10) && `edited ${shortDate(item.edited)}`,
    item.crossedAt && `crossed out ${shortDate(item.crossedAt)}`,
  ].filter(Boolean);
  const under = countDescendants(doc, item.id);

  const row = (
    <div
      ref={rowRef}
      className={`row${flash ? ' flash' : ''}${selected ? ' selected' : ''}`}
      data-select
      onPointerDownCapture={selectOnMouse(pid, item.id)}
      {...(isEditing ? {} : longPress)}
    >
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
          onChange={menu.toggleCross}
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
            onCtrlEnter={ctrlEnterEdit}
          />
        ) : (
          <div className="text" onDoubleClick={startEdit}>
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
      <button className="more" aria-label="Item menu" onClick={(e) => menu.open(e.currentTarget.getBoundingClientRect())}>
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
          {split.open.map((k) => (
            <ItemNode key={k.id} doc={doc} item={k} depth={depth + 1} dragHandle={childDrag} />
          ))}
          <CrossedSection id={groupOf(pid, item.id)} count={split.crossed.length}>
            {split.crossed.map((k) => (
              <ItemNode key={k.id} doc={doc} item={k} depth={depth + 1} dragHandle={childDrag} />
            ))}
          </CrossedSection>
        </div>
      )}
      {menu.element}
    </div>
  );
}

