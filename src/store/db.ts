// Spec §3.5: the working copy on this device, in IndexedDB. One record per Project doc plus the index.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { emptyIndex, type AppData, type IndexDoc, type ProjectDoc } from '../domain/model';

interface Schema extends DBSchema {
  docs: { key: string; value: ProjectDoc };
  meta: { key: string; value: IndexDoc };
}

const NAME = 'personalnote';
let dbp: Promise<IDBPDatabase<Schema>> | null = null;

function db() {
  return (dbp ??= openDB<Schema>(NAME, 1, {
    upgrade(d) {
      d.createObjectStore('docs');
      d.createObjectStore('meta');
    },
  }));
}

export async function loadData(): Promise<AppData> {
  const d = await db();
  const [index, docs] = await Promise.all([d.get('meta', 'index'), d.getAll('docs')]);
  return {
    index: index ?? emptyIndex(),
    docs: Object.fromEntries(docs.map((doc) => [doc.project.id, doc])),
  };
}

/** Write only what changed between `prev` and `next` (the domain keeps unchanged docs by reference). */
export async function saveChanges(prev: AppData, next: AppData): Promise<void> {
  const d = await db();
  const tx = d.transaction(['docs', 'meta'], 'readwrite');
  const docs = tx.objectStore('docs');
  for (const [id, doc] of Object.entries(next.docs)) {
    if (prev.docs[id] !== doc) docs.put(doc, id);
  }
  for (const id of Object.keys(prev.docs)) {
    if (!next.docs[id]) docs.delete(id);
  }
  if (prev.index !== next.index) tx.objectStore('meta').put(next.index, 'index');
  await tx.done;
}

/** Tests only: drop the open connection so the next call reopens. */
export function _resetForTests() {
  dbp = null;
}
