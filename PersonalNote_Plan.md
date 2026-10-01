# Plan: Quick Notetaking App with Mind Maps

## Context
You want a lightweight personal knowledge/project tracker that feels like a messaging app: each conversation = project/major note, with sub-notes/messages, plus simple mind maps. It must work on Windows and Android, auto-save online, and ideally use GitHub as the storage backend. This is a new project with no existing codebase. The goal of this plan is to build it incrementally, with navigation checkpoints, then test together.

## Implementation Plan (phased)

### Phase 0 — Project Setup
1. `npm create vite@latest noteaddle -- --template react-ts`
2. `cd noteaddle && npm install`
3. Install runtime dependencies:
   - `npm install zustand` (state)
   - `npm install idb` (IndexedDB wrapper)
   - `npm install lucide-react` (icons)
4. Install dev dependency:
   - `npm install -D @types/idb`
5. Configure `vite.config.ts` for PWA (`base: './'`)
6. Create `public/manifest.json` and basic `src/sw.ts`
7. Create empty `index.html` with mount point

### Phase 1 — Scaffold & Base PWA
1. Scaffold `src/main.tsx`, `src/App.tsx`
2. Basic App renders `<ProjectList />` and `<ProjectView />`
3. Add PWA manifest and service worker registration
4. Verify: `npm run dev`, app loads, PWA installable

### Phase 2 — GitHub Repo Integration
1. Create private GitHub repo `PersonalNotes`
2. Create a GitHub PAT with `repo` scope
3. Build `src/sync/github.ts`:
   - `getProject(id)` — fetch `projects/<id>.json`
   - `saveProject(project)` — PUT `projects/<id>.json`
   - `getProjectIndex()` — fetch root `projects.json`
   - `saveProjectIndex(index)` — PUT root `projects.json`
   - `commitChange(message)` — create commit with message
4. Build `src/storage/db.ts` — IndexedDB for:
   - `projects` store
   - `messages` store
   - `outbox` store (pending commits)
5. Wire up basic sync on app start
6. Verify: create project in app, `projects/<id>.json` appears in GitHub

### Phase 3 — Project List & Thread View
1. Build `src/components/ProjectList.tsx`
   - List of projects from IndexedDB/GitHub
   - "+ New Project" button
   - Click project → navigate to `<ProjectView projectId={id} />`
2. Build `src/components/ProjectView.tsx`
   - Header with project title
   - View mode toggle (`Map view` ↔ `Task list`)
   - Message list area
3. Build message type renderer in `src/components/ChatThread.tsx`
   - Renders `note` messages as text
   - Renders `mindmap` messages as a preview
   - Renders `task` messages with checkbox
4. Verify: add projects and messages, see them persist locally

### Phase 4 — Message Composer & Auto‑Commit
1. Build `src/components/MessageComposer.tsx`
   - Text input, "Save" button
   - Buttons to choose message type (note / mindmap / task)
2. On save:
   - Add message to local state
   - Commit to GitHub via `github-sync.ts`
   - Clear outbox entry on success
3. Offline handling:
   - If offline, add to `outbox` store
   - On reconnect, process outbox
4. Verify: sending a message creates a GitHub commit visible in repo

### Phase 5 — View Mode Toggle
1. Build `src/components/ViewModeToggle.tsx`
   - Toggle `Map view` ↔ `Task list`
   - Persist `viewMode` in project JSON and local state
2. Wire into `ProjectView`:
   - If `map` → render `<MindMapCanvas />`
   - If `task-list` → render `<TaskListView />`
3. Verify: toggling switches views, preference persists

### Phase 6 — Task List: Add, Tick, Dim, Delete
1. Build `src/components/TaskListView.tsx`
   - Lists messages of type `task`
   - Checkbox for each task
   - Checked tasks render grey, same position
2. Add/delete tasks via composer
3. Tick handler:
   - Toggle `checked: boolean`
   - Never auto-delete
4. Manual delete button for tasks
5. Verify: add task, tick (grey), manual delete all work

### Phase 7 — Simple Mind Map Canvas
1. Build `src/components/MindMapCanvas.tsx`
   - SVG canvas
   - Draggable nodes with labels
   - Edges between nodes
   - Add node on canvas click
   - Connect by dragging from node to node
   - Delete node/edge via right-click/long-press
   - Auto-layout button
2. Mind map data stored as `mindmap` message type
3. Verify: nodes draggable, edges connect, JSON persists

### Phase 8 — Conflict Resolution Flow
1. Build `src/sync/conflicts.ts`:
   - Detect conflict: local `updatedAt` and remote `updatedAt` both > lastKnown
   - Return { lastCommitted, local, remote }
2. Build `src/components/ConflictResolver.tsx`
   - Show all three versions
   - Ask "which is latest?"
   - Buttons: keep local, keep remote, merge, add missing, update either
3. Integrate into sync flow
4. Verify: simulate conflict, see resolver, choose action, result commits

### Phase 9 — Polish & Final Testing
1. Add error handling and loading states
2. Add empty states
3. Test on Android (PWA install) and Windows
4. Test offline scenarios
5. Test conflict scenarios
6. Final review with user feedback

## Order of Execution
1. Execute phases in order
2. At each phase boundary, run the checkpoint
3. After user feedback, adjust before proceeding

## Verification Plan
Each phase ends with its checkpoint from the plan file. After all phases, do a full regression test:
- Create 3 projects
- Add notes, tasks, and mind maps
- Toggle views
- Go offline, make changes, come back online
- Simulate conflict, resolve it
- Verify GitHub repo reflects all changes


## Decisions so far
- GitHub repo: create a new **private** repo named **`PersonalNotes`** (user confirmed).
- Auto-commit: on each saved message/mind-map update (see open question below).

## What I need from you before implementation
- Nothing else is blocking the design. The only remaining choices are implementation details that can be resolved during the build.

## Options

### Option A — Progressive Web App + GitHub raw-file sync (recommended)
- Single codebase: React/TypeScript PWA with a service worker for offline caching.
- Android: installable as a PWA / wrap with Capacitor for Play Store if needed.
- Windows: same PWA run in Edge/Chrome, or wrap with Tauri.
- Storage: each project is a JSON file in a private GitHub repo, synced via GitHub REST/GraphQL API using a personal access token stored only in browser secure storage.
- Mind maps: embedded SVG generated from a simple JSON graph (`nodes` + `edges`).
- Chat metaphor: each top-level “project” is a thread; sub-notes are ordered messages; tasks are a message type with a checkbox that keeps completed items in place but dims them.
- Pros: one codebase everywhere, easy cross-device, no server to host, uses GitHub you already have.
- Cons: GitHub rate limits, raw-file sync is eventually consistent, manual conflict handling needed, requires a PAT.

### Option B — Web app + Gist API
- Same frontend as Option A, but each note/mind map is stored as a Gist (or single Gist with sections).
- Pros: cleaner per-note versioning, no repo management.
- Cons: limited Gist API features, harder to query/search many notes, Gist permissions are all-or-nothing.

### Option C — Supabase/Postgres backend with GitHub export
- A small backend (Supabase or Firebase) stores notes in real time; a GitHub Action or script periodically exports a backup repo.
- Pros: true real-time sync, better conflict handling, no GitHub API rate limits for reads/writes.
- Cons: requires hosting credentials, less “everything in GitHub,” more moving parts.

## Recommended approach
**Option A**, because it matches your GitHub preference, keeps everything open-source and offline-first, and minimizes backend work. The PWA can be wrapped for Android with Capacitor and for Windows with Tauri if you want native installers later.

## Architecture
- **Frontend**: React + TypeScript + Vite. State managed with React Query or Zustand for offline-first edits.
- **Data model**:
  - `Project` = root chat/topic: `{id, title, color, createdAt}`
  - `Message` = sub-note/reply: `{id, projectId, body, type: 'note' | 'mindmap' | 'task', createdAt}`
  - `MindMap` = `{id, projectId, nodes: [{id, label, x, y, color}], edges: [{from, to, label}]}`
  - `Task` = a checklist item: `{id, projectId, text, checked: boolean, createdAt}`. A task is a message of type `task`; checked tasks stay in the list but render dimmed (grey), never auto-deleted.
  - Each project has a **view mode**: `map` or `task-list`, toggled per project and remembered locally.
- **Sync adapter**: `github-sync.ts` reads/writes one project file under `/projects/<projectId>.json` via the GitHub API. Local IndexedDB stores the working copy, revision metadata, and pending changes; sync pushes on online + token available.
- **Automatic commits**: every saved message or mind-map update creates an automatic GitHub commit with a readable message such as `Update project: <title>` or `Add mind map: <id>`. Offline updates remain queued locally and are committed in order once connectivity returns.
- **Offline and conflict handling**: service worker caches assets and recent notes. If local cached changes and the remote project both changed since the last known revision, the app never overwrites silently. It shows a conflict screen that clearly identifies the last known committed version, local cached changes, and remote latest version, then asks the user which version is latest and lets them choose to keep local, keep remote, merge both, add missing content, or update either version before committing the result.
- **View mode toggle**: each project has a toggle (`Map view` ↔ `Task list`) that persists per-project. In map view the mind‑map canvas is shown; in task‑list view a chat‑like list of messages appears, each with a checkbox. Ticked tasks turn grey, remain in position, are never auto‑deleted.
  - `Mind map UI`: simple SVG canvas with draggable nodes, labels, colors, auto‑layout button, and view‑mode toggle button. Add node, connect nodes, export/import JSON.
  - `Task list UI`: ordered list of messages of type `task`, each with a checkbox input. When checked the task text renders dimmed/kept in place (never deleted unless user explicitly removes it).
- **Auth**: GitHub PAT saved in IndexedDB; optionally encrypt at rest using a user passphrase.

## Critical files/directories to create
- `index.html`, `src/main.tsx`, `src/App.tsx` — PWA shell
- `src/data/model.ts` — TypeScript types
- `src/sync/github.ts` — GitHub API read/write
- `src/storage/db.ts` — IndexedDB/LocalStorage abstraction
- `src/components/ProjectList.tsx`, `src/components/ChatThread.tsx`, `src/components/MindMapCanvas.tsx`, `src/components/TaskListView.tsx`, `src/components/ViewModeToggle.tsx`
- `public/manifest.json`, `src/sw.ts` — PWA manifest + service worker
- `capacitor.config.ts` (optional), `tauri.conf.json` (optional) — native wrappers

## Verification
1. `npm create vite@latest noteaddle -- --template react-ts` and run `npm run dev`; verify app loads.
2. Add two projects and a mind map note; check IndexedDB persistence in DevTools.
3. Set a GitHub PAT, create a repo, and verify a note appears in the repo via GitHub web UI.
4. Open the app on Android via PWA install and Windows via browser; confirm edits show on both after sync.
5. Test offline: disable network, add a note, reconnect, confirm it syncs.

## Iterative Build Stages & Navigation Checkpoints
The app is built in **eight incremental stages**; each stage ends with a navigation checkpoint you can test before moving on:

1. **Scaffold & Base PWA**
   - `npm create vite@latest noteaddle -- --template react-ts`, run `npm run dev`.
   - **Checkpoint:** App opens in browser, PWA manifest installed, basic UI visible on Windows.

2. **GitHub Repo Integration**
   - Create private repo `PersonalNotes`, add GitHub PAT to IndexedDB (via dev tools or auth flow).
   - Implement `github-sync.ts` to fetch/create `projects/<id>.json`.
   - **Checkpoint:** App can create a new project; `projects/<id>.json` appears in GitHub repo.

3. **Project List & Thread View**
   - Render list of projects; clicking a project opens a chat‑like message thread.
   - Messages stored locally in IndexedDB and synced to repo.
   - **Checkpoint:** On Windows, you can add/select a project and see its message list; Android PWA install shows the same.

4. **Message Composer & Auto‑Commit**
   - Text input at bottom, "Save" button.
   - On save: auto‑commit to GitHub with message like `Add note: <project title>`.
   - Offline edits queue and commit on reconnect.
   - **Checkpoint:** Sending a message creates a commit visible in GitHub; offline edit pending queues and auto‑commits when back online.

5. **View Mode Toggle (Map ↔ Task List)**
   - Add a toggle button per project: `Map view` ↔ `Task list`.
   - Task list view renders messages of type `task` as a chat‑like list, each with a checkbox.
   - **Checkpoint:** Toggling switches between the mind‑map canvas and the task list; preference persists per project.

6. **Task List: Add, Tick, Dim, Delete**
   - Add a task via composer; it appears as a message of type `task`.
   - Ticking the checkbox turns the task text grey but keeps it in the same position.
   - Tasks are never auto‑deleted; manual delete only.
   - **Checkpoint:** Adding a task, ticking it (turns grey, stays in place), and manually deleting it all work; the list never auto‑clears.

7. **Simple Mind Map Canvas**
   - SVG canvas with draggable nodes, labels, colors, auto‑layout button.
   - Add node, connect nodes, export/import JSON.
   - Mind‑map data stored as a message of type `mindmap`.
   - **Checkpoint:** Opening a project, switching to map view, and clicking "Add Mind Map" opens a canvas; you can drag nodes, and the JSON appears in the project’s message list.

8. **Conflict Resolution Flow**
   - Simulate conflict: edit same project on two browser windows/Profiles offline, then reconnect one.
   - App shows conflict screen listing last‑committed, local, remote versions; asks which is latest; lets you keep/merge/update before committing.
   - **Checkpoint:** Conflict screen appears; you can resolve and the result is committed to GitHub.

After each stage, verify the checkpoint before proceeding. The stages can be run in any order that makes sense for your workflow, but each builds on the previous one.

### How to Navigate During Build
- After completing a stage, open the app on both Windows and Android (PWA install).
- Use the checkpoint list above to confirm the expected behaviour.
- If a checkpoint fails, stop, fix the relevant code, and re‑verify before moving on.
- The **Iterative Build Stages** section lives in the plan so you can tick them off as you go, without needing a separate spec document.