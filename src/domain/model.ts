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

/** Everything the app holds for the user's data. */
export type AppData = {
  index: IndexDoc;
  docs: Record<string, ProjectDoc>;
};

export const emptyIndex = (): IndexDoc => ({ schema: 1, projectOrder: {}, workspaces: {} });
export const emptyData = (): AppData => ({ index: emptyIndex(), docs: {} });
