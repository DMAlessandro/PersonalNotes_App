// Spec §3: AppData ⇄ the files in the PersonalNotes repo. Deterministic: same data → same bytes,
// so comparing file contents tells exactly what a Push must write.
import { isoWeekKey } from '../domain/changelog';
import { emptyIndex, type AppData, type IndexDoc, type LogEntry, type ProjectDoc } from '../domain/model';
import { readableFiles } from './readable';

export type Files = Record<string, string>;

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** Sorted keys, 2-space indent, final newline (spec §3). */
export function stableJson(v: unknown): string {
  return JSON.stringify(sortKeys(v), null, 2) + '\n';
}

export const isDataPath = (p: string) => p.startsWith('data/');

/** Every file the app owns in the repo: data/ plus the generated readable/ copies. */
export function toFiles(data: AppData): Files {
  const files: Files = { 'data/index.json': stableJson(data.index) };
  for (const doc of Object.values(data.docs)) files[`data/projects/${doc.project.id}.json`] = stableJson(doc);
  const weeks: Record<string, Record<string, LogEntry>> = {};
  for (const e of Object.values(data.log)) (weeks[isoWeekKey(e.at)] ??= {})[e.id] = e;
  for (const [week, entries] of Object.entries(weeks)) {
    files[`data/changelog/${week}.json`] = stableJson({ schema: 1, entries });
  }
  return { ...files, ...readableFiles(data) };
}

/** Read the data back from data/ files (readable/ is ignored: it is never a source). */
export function fromFiles(files: Files): AppData {
  const index = files['data/index.json'] ? (JSON.parse(files['data/index.json']) as IndexDoc) : emptyIndex();
  const docs: Record<string, ProjectDoc> = {};
  const log: Record<string, LogEntry> = {};
  for (const [path, text] of Object.entries(files)) {
    if (/^data\/projects\/[^/]+\.json$/.test(path)) {
      const doc = JSON.parse(text) as ProjectDoc;
      docs[doc.project.id] = doc;
    } else if (/^data\/changelog\/[^/]+\.json$/.test(path)) {
      Object.assign(log, (JSON.parse(text) as { entries: Record<string, LogEntry> }).entries);
    }
  }
  return { index: { ...emptyIndex(), ...index }, docs, log };
}

/** Paths whose content differs: new content, or null for a file to delete. */
export function changedFiles(base: Files, next: Files): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [p, c] of Object.entries(next)) if (base[p] !== c) out[p] = c;
  for (const p of Object.keys(base)) if (!(p in next)) out[p] = null;
  return out;
}

/** True when the data holds nothing worth keeping: no Projects and no Change log. */
export function isEmptyData(d: AppData): boolean {
  return Object.keys(d.docs).length === 0 && Object.keys(d.log).length === 0;
}
