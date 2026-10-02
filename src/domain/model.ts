// Spec §2.1 / §3: the records, shaped like the repo files (one doc per Project, Items keyed by id).

export type Timestamp = string; // ISO 8601 with the device's offset
export type DateOnly = string; // YYYY-MM-DD

export type Project = {
  id: string;
  title: string;
  crossed: boolean;
  crossedAt: Timestamp | null;
  crossSnap: Record<string, boolean> | null;
  bottomed: boolean;
  folded: boolean;
  created: Timestamp;
  edited: Timestamp;
  contentAt: Timestamp;
  positionAt: Timestamp;
};

export type ItemType = 'task' | 'note';

export type Item = {
  id: string;
  type: ItemType;
  text: string;
  due: DateOnly | null;
  crossed: boolean;
  crossedAt: Timestamp | null;
  crossSnap: Record<string, boolean> | null;
  parent: string | null;
  order: string;
  bottomed: boolean;
  folded: boolean;
  created: Timestamp;
  edited: Timestamp;
  contentAt: Timestamp;
  positionAt: Timestamp;
};

/** data/projects/<id>.json */
export type ProjectDoc = {
  schema: 1;
  project: Project;
  items: Record<string, Item>;
};

export type ProjectOrderEntry = { order: string; at: Timestamp };

export type Workspace = { name: string; projects: string[]; at: Timestamp };

/** data/index.json */
export type IndexDoc = {
  schema: 1;
  projectOrder: Record<string, ProjectOrderEntry>;
  workspaces: Record<string, Workspace>;
};

/** One Change-log entry (spec §3.3). Stored in data/changelog/<ISO week of `at`>.json. Permanent. */
export type LogEntry = {
  id: string;
  action: 'crossed' | 'deleted' | 'restored';
  at: Timestamp;
  device: string;
  projectId: string;
  projectTitle: string;
  /** null = the whole Project. */
  itemId: string | null;
  text: string;
  /** Items in the branch, the Item itself included (for a Project: all its Items). */
  count: number;
  /** The Item and everything under it, as they were (for a Project: all its Items). */
  branch: Record<string, Item>;
  /** Parent Task records, nearest first, so a restore can bring back a missing chain. */
  ancestors: Item[];
  project: Project;
  projectOrder: string | null;
  workspaces: string[];
  /** For `restored`: the entry that was restored. */
  restores?: string;
};

/** Everything the app holds for the user's data. */
export type AppData = {
  index: IndexDoc;
  docs: Record<string, ProjectDoc>;
  /** Change log, every entry by id; grouped into weekly files only when written to the repo. */
  log: Record<string, LogEntry>;
};

export const emptyIndex = (): IndexDoc => ({ schema: 1, projectOrder: {}, workspaces: {} });
export const emptyData = (): AppData => ({ index: emptyIndex(), docs: {}, log: {} });
