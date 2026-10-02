// Spec §3.5: the working copy on this device, in IndexedDB. One record per Project doc, the index,
// and one record per Change-log entry.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { emptyIndex, type AppData, type IndexDoc, type LogEntry, type ProjectDoc } from '../domain/model';

interface Schema extends DBSchema {
  docs: { key: string; value: ProjectDoc };
  meta: { key: string; value: IndexDoc };
  log: { key: string; value: LogEntry };
}

const NAME = 'personalnote';
let dbp: Promise<IDBPDatabase<Schema>> | null = null;

function db() {
  return (dbp ??= openDB<Schema>(NAME, 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('docs');
        d.createObjectStore('meta');
      }
      if (oldVersion < 2) d.createObjectStore('log');
    },
  }));
}

export async function loadData(): Promise<AppData> {
  const d = await db();
  const [index, docs, log] = await Promise.all([d.get('meta', 'index'), d.getAll('docs'), d.getAll('log')]);
  return {
    index: index ?? emptyIndex(),
    docs: Object.fromEntries(docs.map((doc) => [doc.project.id, doc])),
    log: Object.fromEntries(log.map((e) => [e.id, e])),
  };
}

/** Write only what changed between `prev` and `next` (the domain keeps unchanged records by reference). */
export async function saveChanges(prev: AppData, next: AppData): Promise<void> {
  const d = await db();
  const tx = d.transaction(['docs', 'meta', 'log'], 'readwrite');
  const docs = tx.objectStore('docs');
  for (const [id, doc] of Object.entries(next.docs)) {
    if (prev.docs[id] !== doc) docs.put(doc, id);
  }
  for (const id of Object.keys(prev.docs)) {
    if (!next.docs[id]) docs.delete(id);
  }
  if (prev.index !== next.index) tx.objectStore('meta').put(next.index, 'index');
  if (prev.log !== next.log) {
    const log = tx.objectStore('log');
    for (const [id, e] of Object.entries(next.log)) {
      if (prev.log[id] !== e) log.put(e, id);
    }
  }
  await tx.done;
}

/** Tests only: drop the open connection so the next call reopens. */
export function _resetForTests() {
  dbp = null;
}
