import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { addItem, addProject, setFolded, setProjectFolded } from '../domain/edits';
import { newId } from '../domain/ids';
import { edgePath, layout, openingView, zoomAt, type Box, type Direction, type Size, type View } from '../map/layout';
import { mapTree, type MapNode } from '../map/tree';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import { DueChip, Linkified } from './format';
import { TextEditor } from './TextEditor';
import { useLongPress } from './useLongPress';
import { useItemEditing, useItemMenu, useProjectMenu, useProjectRename } from './itemActions';

// Spec §5.3 box sizing: shrink-wrap the text up to ~210px, wrap only between whole words, and widen the box
// for a word that doesn't fit. Width comes from measuring the text, never from a constant.
const MAXW = 210;
const MINW = 96;
const EDIT_MINW = 180;
const DIR_KEY = 'pn.mapDirection';

function loadDir(): Direction {
  try {
    return localStorage.getItem(DIR_KEY) === 'td' ? 'td' : 'lr';
  } catch {
    return 'lr';
  }
}

function flatten(n: MapNode, out: MapNode[] = []): MapNode[] {
  out.push(n);
  n.kids.forEach((k) => flatten(k, out));
  return out;
}

/** Measure one off-screen box: wrap at MAXW, shrink to the widest wrapped line (or the longest word), read the height. */
function measureBox(el: HTMLElement, minW: number): Size {
  el.style.width = 'max-content';
  el.style.maxWidth = `${MAXW}px`;
  el.style.minWidth = `${minW}px`;
  let w = el.offsetWidth;
  const txt = el.querySelector('.m-txt');
  const body = el.querySelector<HTMLElement>('.m-body');
  if (txt && body && txt.textContent) {
    const r = document.createRange();
    r.selectNodeContents(txt);
    const rects = [...r.getClientRects()];
    if (rects.length) {
      const tw = Math.max(...rects.map((q) => q.right)) - Math.min(...rects.map((q) => q.left));
      const meta = el.querySelector<HTMLElement>('.m-meta');
      w = el.offsetWidth - body.offsetWidth + Math.max(tw, meta?.scrollWidth ?? 0) + 2;
    }
  }
  w = Math.max(minW, Math.ceil(w));
  el.style.maxWidth = 'none';
  el.style.width = `${w}px`;
  return { w, h: Math.ceil(el.offsetHeight) };
}

/**
 * Text that may wrap only at spaces: each run of non-space characters is kept on one line, so a hyphen or
 * slash never splits a word (spec §5.3). A run that is a URL stays clickable.
 */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((seg, i) =>
        i % 2 ? (
          seg
        ) : seg ? (
          <span key={i} className="nw">
            <Linkified text={seg} />
          </span>
        ) : null,
      )}
    </>
  );
}

type Handlers = {
  onFold?: () => void;
  onTick?: () => void;
  onMenu?: (r: DOMRect) => void;
  onEdit?: () => void;
  onAddProject?: () => void;
};

/** What a box shows. Used both for the real box and for the hidden copy that is measured. */
function BoxBody({ node, editor, h = {} }: { node: MapNode; editor?: ReactNode; h?: Handlers }) {
  if (node.kind === 'ws') {
    return (
      <>
        <div className="m-body">
          <span className="m-txt">{node.label}</span>
        </div>
        <button className="m-add" onClick={h.onAddProject}>
          + Project
        </button>
      </>
    );
  }
  const it = node.item;
  const folded = node.hidden > 0 || (node.hasKids && !node.kids.length);
  const meta = !editor && (node.hidden > 0 || node.progress || node.due);
  return (
    <>
      {node.hasKids ? (
        <button className="m-fold" aria-label={folded ? 'Unfold' : 'Fold'} aria-expanded={!folded} onClick={h.onFold}>
          {folded ? '▸' : '▾'}
        </button>
      ) : (
        <span className="m-fold" />
      )}
      {it?.type === 'task' && (
        <input type="checkbox" className="m-tick" checked={it.crossed} aria-label={it.crossed ? 'Un-tick' : 'Tick'} onChange={h.onTick ?? (() => {})} />
      )}
      <div className="m-body">
        {editor || (
          <span className="m-txt" onDoubleClick={h.onEdit}>
            <Words text={node.label} />
          </span>
        )}
        {meta && (
          <span className="m-meta">
            {node.hidden > 0 && <span className="m-hidden">+{node.hidden}</span>}
            {node.progress && <span className="m-prog">{`${node.progress.done}/${node.progress.total}`}</span>}
            {node.due && <DueChip due={node.due} muted={node.crossed} />}
          </span>
        )}
      </div>
      {!editor && (
        <button className="m-more" aria-label={it ? 'Item menu' : 'Project menu'} onClick={(e) => h.onMenu?.(e.currentTarget.getBoundingClientRect())}>
          ⋯
        </button>
      )}
    </>
  );
}

const boxClass = (n: MapNode) =>
  `mbox m-${n.kind === 'item' ? n.item!.type : n.kind}${n.crossed ? ' crossed' : ''}`;

const place = (b: Box | undefined) =>
  b ? { left: b.x, top: b.y, width: b.w, minHeight: b.h } : { visibility: 'hidden' as const };

function ItemBox({ node, box }: { node: MapNode; box: Box | undefined }) {
  const pid = node.pid!;
  const item = node.item!;
  const doc = useStore((s) => s.data.docs[pid]);
  const apply = useStore((s) => s.apply);
  const edit = useItemEditing(pid, item);
  const menu = useItemMenu(doc, item);
  const longPress = useLongPress((el) => menu.open(el.getBoundingClientRect()));
  return (
    <div className={`${boxClass(node)}${menu.isOpen ? ' sel' : ''}`} style={place(box)} data-key={node.key} {...(edit.isEditing ? {} : longPress)}>
      <BoxBody
        node={node}
        editor={
          edit.isEditing && (
            <TextEditor initial={item.text} placeholder={item.type === 'task' ? 'Task' : 'Note'} onDone={edit.finishEdit} onCancel={edit.cancelEdit} onTab={edit.tabEdit} />
          )
        }
        h={{
          onFold: () => apply((d, now) => setFolded(d, pid, item.id, !item.folded, now)),
          onTick: menu.toggleCross,
          onMenu: menu.open,
          onEdit: edit.startEdit,
        }}
      />
      {menu.element}
    </div>
  );
}

function ProjectBox({ node, box }: { node: MapNode; box: Box | undefined }) {
  const pid = node.pid!;
  const apply = useStore((s) => s.apply);
  const folded = useStore((s) => s.data.docs[pid]?.project.folded ?? false);
  const startEditing = useUi((s) => s.startEditing);
  const rename = useProjectRename(pid);
  const addTask = () => {
    const id = newId('i');
    apply((d, now) => addItem(d.docs[pid].project.folded ? setProjectFolded(d, pid, false, now) : d, pid, { id, type: 'task', text: '', parent: null }, now));
    startEditing(`item:${id}`, id);
  };
  const menu = useProjectMenu(pid, [{ label: 'Add Task', onSelect: addTask }]);
  const longPress = useLongPress((el) => menu.open(el.getBoundingClientRect()));
  return (
    <div className={boxClass(node)} style={place(box)} data-key={node.key} {...(rename.isEditing ? {} : longPress)}>
      <BoxBody
        node={node}
        editor={rename.isEditing && <TextEditor initial={node.label} placeholder="Project name" onDone={rename.finishEdit} onCancel={rename.cancelEdit} />}
        h={{
          onFold: () => apply((d, now) => setProjectFolded(d, pid, !folded, now)),
          onMenu: menu.open,
          onEdit: rename.startEdit,
        }}
      />
      {menu.element}
    </div>
  );
}

function WorkspaceBox({ node, box }: { node: MapNode; box: Box | undefined }) {
  const apply = useStore((s) => s.apply);
  const startEditing = useUi((s) => s.startEditing);
  const addNew = () => {
    const id = newId('p');
    apply((d, now) => addProject(d, { id, title: '' }, now, useUi.getState().workspace));
    startEditing(`project:${id}`, id);
  };
  return (
    <div className={boxClass(node)} style={place(box)} data-key={node.key}>
      <BoxBody node={node} h={{ onAddProject: addNew }} />
    </div>
  );
}

/**
 * Spec §5.3: the current Workspace as an automatic tree (left → right, or top-down by a switch remembered on
 * this device). Laptop: drag the background to pan, wheel to zoom, Fit. Touch: one finger pans, two pinch.
 */
export function MapView() {
  const data = useStore((s) => s.data);
  const workspace = useUi((s) => s.workspace);
  const editing = useUi((s) => s.editing);
  const tree = useMemo(() => mapTree(data, workspace), [data, workspace]);
  const nodes = useMemo(() => flatten(tree), [tree]);
  const [dir, setDir] = useState<Direction>(loadDir);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [view, setView] = useState<View>({ tx: 15, ty: 15, s: 1 });
  const measureRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const fitPending = useRef(true);
  const fitFor = useRef('');

  // Measure every box after each render; store sizes only when one changed.
  useLayoutEffect(() => {
    const els = [...(measureRef.current?.children ?? [])] as HTMLElement[];
    const next: Record<string, Size> = {};
    let changed = els.length !== Object.keys(sizes).length;
    for (const el of els) {
      const key = el.dataset.key!;
      const s = measureBox(el, editing === key ? EDIT_MINW : MINW);
      next[key] = s;
      const old = sizes[key];
      if (!old || old.w !== s.w || old.h !== s.h) changed = true;
    }
    if (changed) setSizes(next);
  });

  const lay = useMemo(() => layout(tree, (k) => sizes[k] ?? { w: MINW, h: 40 }, dir), [tree, sizes, dir]);
  const byKey = useMemo(() => Object.fromEntries(lay.boxes.map((b) => [b.key, b])), [lay]);
  const ready = nodes.every((n) => sizes[n.key]);

  const vpSize = (): Size => {
    const r = vpRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 800, h: r?.height ?? 600 };
  };

  // Opening zoom (on opening, on a Workspace change and on a layout switch): never below ~12px text.
  // (Decided during render, so the layout effect below sees it in the same commit.)
  const fitKey = `${workspace ?? ''}|${dir}`;
  if (fitFor.current !== fitKey) {
    fitFor.current = fitKey;
    fitPending.current = true;
  }
  useLayoutEffect(() => {
    if (!ready || !fitPending.current) return;
    fitPending.current = false;
    setView(openingView({ w: lay.width, h: lay.height }, vpSize()));
  }, [ready, lay]);

  const fitAll = () => {
    const vp = vpSize();
    const pad = 30;
    const s = Math.max(0.15, Math.min(1.2, (vp.w - pad) / (lay.width || 1), (vp.h - pad) / (lay.height || 1)));
    setView({ s, tx: (vp.w - lay.width * s) / 2, ty: (vp.h - lay.height * s) / 2 });
  };
  const zoomCentre = (k: number) => {
    const vp = vpSize();
    setView((v) => zoomAt(v, k, vp.w / 2, vp.h / 2));
  };
  const switchDir = () => {
    const d = dir === 'lr' ? 'td' : 'lr';
    setDir(d);
    try {
      localStorage.setItem(DIR_KEY, d);
    } catch {
      /* per-device convenience only */
    }
  };

  // Wheel zoom around the pointer (needs a non-passive listener to stop the page scrolling).
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const k = Math.exp(-e.deltaY * 0.0015);
      setView((v) => zoomAt(v, k, e.clientX - r.left, e.clientY - r.top));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pan with one pointer on the background, pinch with two.
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'pan'; x: number; y: number; v: View }
    | { kind: 'pinch'; d0: number; s0: number; wx: number; wy: number }
    | null
  >(null);
  const rel = (e: RPointerEvent) => {
    const r = vpRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const onBackground = !(e.target as HTMLElement).closest('.mbox, .map-tools, [role=dialog]');
    if (!onBackground && pts.current.size === 0) return;
    pts.current.set(e.pointerId, rel(e));
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: view.s, wx: (mid.x - view.tx) / view.s, wy: (mid.y - view.ty) / view.s };
    } else {
      gesture.current = { kind: 'pan', x: e.clientX, y: e.clientY, v: view };
    }
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, rel(e));
    const g = gesture.current;
    if (g?.kind === 'pinch' && pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(2.5, Math.max(0.15, (g.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0));
      setView({ s, tx: mid.x - g.wx * s, ty: mid.y - g.wy * s });
    } else if (g?.kind === 'pan') {
      setView({ ...g.v, tx: g.v.tx + e.clientX - g.x, ty: g.v.ty + e.clientY - g.y });
    }
  };
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size === 1) {
      const [p] = [...pts.current.values()];
      const r = vpRef.current!.getBoundingClientRect();
      gesture.current = { kind: 'pan', x: p.x + r.left, y: p.y + r.top, v: view };
    } else if (!pts.current.size) gesture.current = null;
  };

  return (
    <main className="map">
      <div className="map-tools">
        <button className="secondary small" onClick={switchDir} title="Switch the layout (remembered on this device)">
          {dir === 'lr' ? '→ Left to right' : '↓ Top-down'}
        </button>
        <span className="spacer" />
        <button className="secondary small" aria-label="Zoom in" onClick={() => zoomCentre(1.25)}>
          +
        </button>
        <button className="secondary small" aria-label="Zoom out" onClick={() => zoomCentre(0.8)}>
          −
        </button>
        <button className="secondary small" onClick={fitAll}>
          Fit
        </button>
      </div>
      <div
        ref={vpRef}
        className="map-vp"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="map-world" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}>
          <svg className="map-edges" width={lay.width} height={lay.height} aria-hidden="true">
            {lay.edges.map((e) => byKey[e.from] && byKey[e.to] && <path key={e.to} d={edgePath(byKey[e.from], byKey[e.to], dir)} />)}
          </svg>
          {nodes.map((n) =>
            n.kind === 'ws' ? (
              <WorkspaceBox key={n.key} node={n} box={byKey[n.key]} />
            ) : n.kind === 'project' ? (
              <ProjectBox key={n.key} node={n} box={byKey[n.key]} />
            ) : (
              <ItemBox key={n.key} node={n} box={byKey[n.key]} />
            ),
          )}
        </div>
      </div>
      <div ref={measureRef} className="map-measure" aria-hidden="true" inert>
        {nodes.map((n) => (
          <div key={n.key} className={boxClass(n)} data-key={n.key}>
            <BoxBody node={n} />
          </div>
        ))}
      </div>
    </main>
  );
}
