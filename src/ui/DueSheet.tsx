import { useState } from 'react';
import type { Item } from '../domain/model';
import { setDue } from '../domain/edits';
import { useStore } from '../store/store';
import { Panel } from './Panel';

/** Due-date picker in a bottom panel (spec §4.4). */
export function DueSheet({ pid, item, onClose }: { pid: string; item: Item; onClose: () => void }) {
  const apply = useStore((s) => s.apply);
  const [value, setValue] = useState(item.due ?? '');
  const save = (due: string | null) => {
    if (due !== item.due) apply((d, now) => setDue(d, pid, item.id, due, now));
    onClose();
  };

  return (
    <Panel onClose={onClose} label="Due date">
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save(value || null);
        }}
      >
        <p className="form-title">Due date</p>
        <p className="form-sub">{item.text}</p>
        <input type="date" className="field" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        <div className="actions">
          {item.due && (
            <button type="button" className="secondary" onClick={() => save(null)}>
              Clear
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </Panel>
  );
}
