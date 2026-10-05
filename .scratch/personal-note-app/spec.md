# PersonalNote — buildable spec

Status: **approved by the user** (2026-10-02, "ok continue": every open point in §11 accepted as written). Written from tickets 01–11 (`issues/`), `CONTEXT.md` and the prototypes. When a ticket and this spec disagree, tell the agent: the ticket was reviewed by the user, the spec is the agent's write-up.

Terms are from `CONTEXT.md` (Project, Item, Task, Note, Subtask, Workspace, Crossed out, Delete, Change log, Save, Push, Pull, Clash, Readable copy). Anything marked **[open]** was an agent default; the user accepted all of them on 2026-10-02 (§11).

---

## 1. What we are building

A Progressive Web App for one user on a Windows laptop (Chrome/Edge) and an Android phone (Chrome, installed to the home screen).

- Projects hold an outline of Tasks, Subtasks and Notes, shown as **Cards** (List view) or as an automatic **tree** (Map view).
- Every edit is **Saved** on the device at once. Nothing reaches GitHub until the user presses **Push**.
- Data lives in the private repo **`PersonalNotes`**. The app's code lives in the public repo **`PersonalNotes_App`**, served by GitHub Pages.
- No server of our own. The browser talks only to `api.github.com`, with a fine-grained token pasted once per device.

Not in v1 (from `map.md` → Out of scope): native installers, other users, manual links between map boxes, reminders/notifications, an "upcoming deadlines" overview, export beyond the repo, a designed resolver screen.

---

## 2. Data model

### 2.1 Records

All ids are random, stable strings made on the device (`p_` + 10 base-36 chars for Projects, `i_` for Items, `w_` for Workspaces, `c_` for Change-log entries). Timestamps are ISO 8601 with milliseconds and the device's offset (`2026-10-02T09:14:00.123+02:00`); they are always compared as real instants (`Date.parse`), never as strings, because the offset can differ (clock changes, travel). Due dates are plain dates (`2026-10-10`).

**Project**

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable; names the data file. |
| `title` | string | Shown everywhere; the Readable copy is named after it. |
| `crossed` | bool | Crossed out. |
| `crossedAt` | timestamp \| null | |
| `crossSnap` | `{[itemId]: bool}` \| null | Each Item's `crossed` before the Project was crossed out, so Un-cross puts them back. |
| `bottomed` | bool | Sent "↓ bottom" of the Project list. Cleared on Un-cross. |
| `folded` | bool | Folded in the Map view. |
| `created`, `edited` | timestamp | `edited` = last content change. |
| `contentAt`, `positionAt` | timestamp | For merging (§6). |

A Project's **order key** and **Workspace membership** live in `index.json`, not in the Project file (§3).

**Item**

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable, also when moved to another Project. |
| `type` | `"task"` \| `"note"` | Note → Task only. |
| `text` | string | Plain multi-line text. URLs become clickable when shown. |
| `due` | date \| null | Tasks only. |
| `crossed` | bool | Ticked (Task) or crossed out (Note). |
| `crossedAt` | timestamp \| null | |
| `crossSnap` | `{[itemId]: bool}` \| null | Descendants' `crossed` before this Item was crossed out. |
| `parent` | itemId \| null | `null` = top level of the Project. Must be a Task. |
| `order` | string | Fractional order key among its siblings (manual order). |
| `bottomed` | bool | Sent "↓ bottom" of its level. Cleared on Un-cross. |
| `folded` | bool | Branch folded; shared by List and Map, both devices. |
| `created`, `edited` | timestamp | Shown in small grey text, with `crossedAt`. |
| `contentAt` | timestamp | Last change to `text`, `type`, `due`, `crossed`. |
| `positionAt` | timestamp | Last change to `parent`, `order`, `bottomed`, Project (move), `folded`. |

**Structural rules (enforced by every operation and checked after every merge):**
1. A Note always has a Task as parent: never top level, never under a Note.
2. A Note has no children. Only Tasks have children (Tasks or Notes), no depth limit.
3. Only Tasks have `due`.
4. No cycles.

**Workspace** — `{ id, name, projects: [projectId…], at }`. The built-in **All Projects** is not stored; it is every Project.

**Change-log entry** — see §3.3.

### 2.2 Derived values (never stored)

- **Progress** of a Task with children: crossed children / all children, direct children only (e.g. `2/5`). **[open]** direct children vs whole branch.
- **Project deadline chip**: the earliest `due` among the Project's **open** Tasks at any depth. Red when overdue, amber when today.
- **Project sort date**: the earliest `due` among **all** its Tasks at any depth, ticked or not, skipping Items with `bottomed = true` and everything under them. So ticking never moves a Project.
- **Unpushed count**: the number of Projects/Items/Workspaces/entries whose stored data differs from the last pulled version, **ignoring `folded`** (fold changes are still Pushed, they just don't count).

---

## 3. Files in the `PersonalNotes` repo

```
data/index.json                   Workspaces + the single manual Project order
data/projects/<projectId>.json    one Project and all its Items
data/changelog/<YYYY>-W<ww>.json  Change log, one file per ISO week
readable/<Project title>.md       generated on each Push; read-only, overwritten
```

All JSON is written with sorted keys, 2-space indent and a final newline, so the same data always gives the same bytes (stable diffs, and the app can compare blob SHAs).

### 3.1 `data/index.json`

```json
{
  "schema": 1,
  "projectOrder": {
    "p_k3j9x0aa1b": { "order": "a0", "at": "2026-10-01T18:02:00+02:00" },
    "p_7tq2m1zz9c": { "order": "a1", "at": "2026-10-01T18:05:00+02:00" }
  },
  "workspaces": {
    "w_r82kd0q1aa": {
      "name": "Research",
      "projects": ["p_k3j9x0aa1b"],
      "at": "2026-10-01T18:10:00+02:00"
    }
  }
}
```

### 3.2 `data/projects/<projectId>.json`

```json
{
  "schema": 1,
  "project": {
    "id": "p_k3j9x0aa1b",
    "title": "Grant proposal",
    "crossed": false, "crossedAt": null, "crossSnap": null,
    "bottomed": false, "folded": false,
    "created": "2026-09-20T10:00:00+02:00",
    "edited": "2026-09-29T08:30:00+02:00",
    "contentAt": "2026-09-29T08:30:00+02:00",
    "positionAt": "2026-09-20T10:00:00+02:00"
  },
  "items": {
    "i_a1b2c3d4e5": {
      "id": "i_a1b2c3d4e5", "type": "task", "text": "Draft introduction",
      "due": "2026-10-10", "crossed": false, "crossedAt": null, "crossSnap": null,
      "parent": null, "order": "a0", "bottomed": false, "folded": false,
      "created": "2026-09-20T10:01:00+02:00", "edited": "2026-09-29T08:30:00+02:00",
      "contentAt": "2026-09-29T08:30:00+02:00", "positionAt": "2026-09-20T10:01:00+02:00"
    },
    "i_f6g7h8j9k0": {
      "id": "i_f6g7h8j9k0", "type": "note", "text": "Use the 2024 call text https://example.org/call",
      "due": null, "crossed": false, "crossedAt": null, "crossSnap": null,
      "parent": "i_a1b2c3d4e5", "order": "a0", "bottomed": false, "folded": false,
      "created": "2026-09-21T09:00:00+02:00", "edited": "2026-09-21T09:00:00+02:00",
      "contentAt": "2026-09-21T09:00:00+02:00", "positionAt": "2026-09-21T09:00:00+02:00"
    }
  }
}
```

Items are a map by id (not a nested tree) so the merge works per Item and a move only changes `parent`/`order`.

### 3.3 `data/changelog/2026-W40.json`

```json
{
  "schema": 1,
  "entries": {
    "c_m2n3b4v5c6": {
      "id": "c_m2n3b4v5c6",
      "action": "deleted",
      "at": "2026-10-02T09:14:00+02:00",
      "device": "Phone",
      "projectId": "p_k3j9x0aa1b",
      "projectTitle": "Grant proposal",
      "itemId": "i_a1b2c3d4e5",
      "text": "Draft introduction",
      "count": 2,
      "branch": { "i_a1b2c3d4e5": { "…": "full Item record" }, "i_f6g7h8j9k0": { "…": "…" } },
      "ancestors": [ { "…": "parent Task records, nearest first" } ],
      "project": { "…": "full Project record" },
      "projectOrder": "a0",
      "workspaces": ["w_r82kd0q1aa"]
    }
  }
}
```

- `action`: `crossed` | `deleted` | `restored`. For a whole Project, `itemId` is null and `branch` holds all its Items.
- `branch` + `ancestors` + `project` are what make "restore the chain" possible after the parent or the Project is gone too.
- Entries are permanent. A file for a past week is only ever **added to** (by a merge of entries made on the other device in that week), never edited.
- The week is the ISO week of `at` in the device's time zone.

### 3.4 `readable/<Project title>.md`

Regenerated for every Project touched by a Push; removed when the Project is Deleted; renamed (old path deleted) when the title changes. Characters not allowed in file names are replaced with `-`; two Projects with the same title get ` (2)`. Example:

```markdown
# Grant proposal

_Next deadline: 10 Oct 2026 · generated by PersonalNote, do not edit_

- [ ] Draft introduction — due 2026-10-10
  - Use the 2024 call text https://example.org/call
- [x] ~~Book meeting room~~ (crossed out 2026-09-30)
```

Order follows the app's ordering (§4.1).

### 3.5 What stays on the device only

In IndexedDB (`idb`):
- `current`: the working copy of every record above, Saved on every edit.
- `base`: the last pulled commit SHA, its tree's blob SHA per path, and the parsed records of that commit (the "base" of the three-way merge).
- `pendingClashes`: Clashes found by a Pull and not yet settled.
- `settings`: device name, owner, repo, branch.

In `localStorage`: the token (ticket 08), and the last ref ETag.

Never stored: the current Workspace (the app always opens on All Projects).

---

## 4. Rules: ordering, crossing out, deleting

### 4.1 Ordering (the same at every level: Projects, top-level Tasks, children)

Siblings are shown in three groups:
1. **Dated**: Items with a `due` and `bottomed = false`, nearest/overdue first; ties by `order`. Crossed-out dated Items **stay in this group** (crossing out never moves anything).
2. **The rest**: `bottomed = false`, no `due`, by `order`.
3. **Sent to bottom**: `bottomed = true`, by `order`.

For Projects the "due" is the **Project sort date** (§2.2) and `order` comes from `index.json`.

Dragging changes only `order`. A dated Item can be dragged, but it is still shown in date order while it has a due date. **[open]**

### 4.2 Crossing out

- **Cross out** (tick a Task, or ⋯ → Cross out on a Note or Project): sets `crossed`, `crossedAt`, records `crossSnap` of every descendant, crosses out the whole branch and folds it. Adds a `crossed` Change-log entry.
- **Un-cross** (untick, or ⋯ → Un-cross, or "Un-cross" on its log entry): clears `crossed`, `crossedAt`, `bottomed`; puts each descendant back as recorded in `crossSnap`; unfolds. Not logged. **[open]**
- A child can be crossed out on its own; the parent shows progress (`2/5`).
- Crossing out a **Project** works like an Item: all its Items are crossed out (with `crossSnap`), the Project is greyed and folded. **[open]**
- Crossing out never changes `order`, never leaves the dated group.
- **↓ bottom** (shown only on a crossed-out Item/Project): sets `bottomed = true` and gives it an `order` after its last sibling.

### 4.3 Deleting

- **Delete** appears in the ⋯ menu **only on a crossed-out Item or Project**. It asks for confirmation in an in-app bottom panel (never a browser pop-up).
- Deleting removes the Item and its whole branch (or the Project file, its Readable copy and its membership/order in `index.json`) and adds a `deleted` Change-log entry with the full content.
- Deleting a **Workspace** (from Workspace settings, with confirmation) removes only the selection. Not logged.

### 4.4 Other edits

| Edit | Where | Rule |
|---|---|---|
| Add Task (top level) | + button (List), "+ Task" on Project box (Map) | Goes to the end of the top level. Joins nothing else. |
| Add Subtask (shortcut) | "Subtask" button next to + (List) | Panel with an "Under" picker of the Project's Tasks (remembers the last one chosen, per Project, until the app closes), text, optional due date. Goes to the end of that Task's children and unfolds it. *(User, 2026-10-02.)* |
| Add under | ⋯ on a Task | Task or Note, at the end of that Task's children. |
| Add Project | Project list +, "+ Project" on the Map root | Joins the current Workspace if one is selected. |
| Edit text | in place on the box/card | Multi-line field; Enter saves, Shift+Enter is a new line, Esc cancels. Empty text on a new Item discards it. |
| Set / clear due date | ⋯ → Due date | Tasks only; bottom-panel date picker. |
| Note → Task | ⋯ on a Note | One way only. |
| Reorder | drag the ⠿ handle (laptop and phone) | Same level only. |
| Indent / Outdent | ⋯ → Indent / Outdent; Tab / Shift+Tab while editing on laptop | Indent = becomes last child of the Task just above. Not offered when it would break §2.1 (e.g. a Note can't be outdented to top level). **[open]** |
| Move to Project… | ⋯ | The Item and its branch go to the end of the other Project's top level (a Note can't be top level, so a Note is moved with "Make Task" first, or the option is hidden for Notes). **[open]** |
| Fold / unfold | arrow on a card/box | Saved per Item, Pushed, not counted as unpushed. |
| Rename Project | ⋯ on Project | |
| Workspaces… | ⋯ on Project, or Workspace settings | Membership from either side. |

Every edit sets `edited`/`contentAt` or `positionAt` to now, and is Saved immediately.

---

## 5. Screens

One top bar on every screen: **menu** (☰), **Workspace picker** (All Projects + the user's Workspaces), **List / Map** switch, **search** icon **[open]**, the **"N unpushed" badge** and **Push**. The badge is always visible. Push shows a spinner while working and a short toast with the result.

### 5.1 Project list (home, List mode)

- The Projects of the current Workspace, ordered by §4.1.
- Each row: title, next deadline chip, open Task count **[open]**, crossed-out Projects greyed with "↓ bottom".
- + button adds a Project. ⋯ per row: Rename, Workspaces…, Cross out / Un-cross, ↓ bottom and Delete (crossed only).
- Drag rows to change the one manual Project order.
- Laptop: the list is a left column and the selected Project's Cards fill the rest. Phone: tapping a Project opens its List view full screen, back arrow returns. **[open]**

### 5.2 List view — Cards (ticket 07, prototype variant C)

- Header: Project title, deadline chip, **Log** button (this Project's Change-log entries, side panel on laptop, full screen on phone).
- Each **top-level Task is a card**: tick box, title, due chip, progress count and bar, ⋯, fold arrow. Its branch is inside, **indented with a guide line**; first-level children are clearly indented (the bug the user caught). On a phone the indent stops growing after about 4 levels.
- Notes: no tick box, italic text in a dashed outline like the Map's Notes **[open]**, links clickable.
- Small grey line per Item: created / edited / crossed-out dates.
- Laptop: cards in as many columns as fit the window (no maximum). Phone: one column.
- Round **+** opens a bottom panel to add a top-level Task (text, optional due date). Notes and Subtasks are added from ⋯ → Add under.
- Next to **+**, a **Subtask** button (shown once the Project has a Task) opens the same panel with an "Under" Task picker (§4.4). *(User, 2026-10-02.)*
- **Long-press (~0.5 s) on a Task, Note or Project row opens its ⋯ menu** on touch screens, with a short vibration, as in the Map view. A moving finger (scroll) or a short tap does not; the lift after a long-press is not a tap. *(User, 2026-10-02.)*
- Reordering uses the ⠿ handle on laptop and phone (not long-press-drag), since long-press now opens the menu.
- Crossed-out Items: struck through, greyed, branch folded, **↓ bottom** button, Delete in ⋯.

### 5.3 Map view (tickets 06 and 11, `prototypes/map-touch-prototype.html`)

- Shows the **current Workspace** as a tree: Workspace pill (with "+ Project") → Projects (tinted boxes) → Tasks (cards with tick box, due chip, progress n/m) → children. **Notes are small dashed, italic boxes.** A folded branch shows "+N".
- **Left → right** on laptop and phone. A **Top-down** switch in the Map's toolbar is manual and remembered per device. **[open]**
- **Placement is always automatic** (no dragging boxes, no saved positions). Sibling order = §4.1. Folds are the same as in the List view.
- **Box sizing:** each box measures its text and shrink-wraps it up to ~210px, wrapping **only between whole words**. A word longer than that widens the box instead of being split. Boxes grow taller to fit. Due date and progress sit on a second line under the text. Each column is as wide as its widest box. Boxes never overlap. Width comes from measuring the text, never from a constant.
- **Zoom on opening:** never below ~12px text (scale 0.85 of 14px). If everything fits at that scale it is centred; otherwise it opens at the top-left and the user pans. Manual zoom can go further out.
- **Laptop:** drag the background to pan, wheel to zoom, a "Fit" button, click ⋯ for the menu.
- **Phone:** one finger on the background pans; two fingers pinch-zoom; **long-press (~0.5 s) on a box opens its menu** with a short vibration; tapping ⋯ also works. Tick boxes (22px), fold arrows and ⋯ are bigger on touch screens. The ⋯ menu, due-date picker and Delete confirmation are bottom panels.
- **Editing on the box** (laptop and phone): the text turns into a wrapping multi-line field in place; Enter saves. A new Item appears as an empty box where it will live, ready to type into.
- ⋯ menu: + Task under, + Note under (Tasks only), Edit / Rename, Due date, Note → Task, Cross out / Un-cross; **↓ bottom and Delete only once crossed out**.
- Drawing: plain HTML boxes positioned absolutely, with an SVG layer for the connector lines; no graph library.

### 5.4 Search (ticket 10)

- Opened from the search icon; full screen on phone, an overlay panel on laptop.
- Matches **Item text** (Tasks and Notes), case-insensitive substring, across **all Projects**. Project names and the Change log are not searched.
- Results: current Workspace first, then "Other Projects". Within each, open matches first, then crossed-out ones dimmed and struck through.
- Each result: the Item text with the match highlighted, its parent path, its Project.
- One filter: **Has due date** — only dated Tasks, nearest first.
- Tapping a result opens that Project's List view, unfolds the path, scrolls to the Item and highlights it briefly. (Unfolding here does change `folded`, like any unfold.)

### 5.5 Change log (ticket 09)

- **Per Project**: the Log button in the List view. **Global**: ☰ → Change log, including Deleted Projects.
- Grouped by week, newest first: "This week", "Last week", "Week 38"….
- Each entry: what happened (Crossed out / Deleted / Restored), Item text, Project, date, device, number of Items under it.
- **Restore** (on `deleted` entries): brings back the branch where it was. If its parent Task or its Project is also gone, they come back too (from `ancestors` / `project`). Restored Items keep their ids. Adds a `restored` entry; the old entry stays. If the Item already exists again (restored before), the button is disabled.
- **Un-cross** (on `crossed` entries) while that Item is still crossed out, offered only on the newest Cross-out entry of that Item.
- Entries are permanent.

### 5.6 Clash resolver (ticket 05)

- Opens **as soon as a Pull finds Clashes**, one Clash at a time ("1 of 3").
- Plain side-by-side: **This device** | **Other device**, showing the Item's text, ticked or not, due date, and each side's change time.
- Buttons: **Keep this device's**, **Keep the other's**, **Keep both** (the other version is added as a new sibling right after; children stay with the original).
- Can be closed and reopened from a banner ("2 clashes to settle"); Push is blocked until all are settled.

### 5.7 Settings (☰ → Settings)

- Device name (used in commit messages and the Change log), e.g. "Laptop", "Phone".
- GitHub owner, repo (default `PersonalNotes`), branch (default `main`).
- Token: paste field, shown masked, **Test connection** button, **Forget token**.
- Persistent storage status ("granted" / "not granted, ask again").
- Refresh (= Pull now). Also in ☰.
- Workspaces: list, add, rename, delete (with confirmation), and tick boxes to pick each one's Projects.
- App version and "last pulled" time.

### 5.8 First-run setup

Shown when no settings exist:
1. Short explanation: data goes to your private repo; nothing leaves this device until you press Push.
2. Device name.
3. Owner + repo + a link to GitHub's fine-grained token page, with the exact settings to choose (only `PersonalNotes`, Contents: Read and write, expiry of the user's choice).
4. Paste token → **Test**: `GET /repos/{owner}/{repo}` must answer 200 with push permission.
5. If the repo is empty, the app writes `data/index.json` with the Contents API (the Git Data API refuses empty repos), then Pulls.
6. Ask for persistent storage (`navigator.storage.persist()`) and show the result.
7. Land on All Projects.

The app can also be used with no token at all (local only); the Push button then says "Set up GitHub".

**First connection of a device that already has Projects** (agent, 2026-10-02, built in slice 4): if GitHub holds no Projects yet, this device's data is kept and becomes unpushed. If both hold Projects, the app asks: **Keep both** (union; Push afterwards sends this device's) or **Use GitHub's only** (this device's are discarded). Closing the question leaves the device unconnected until the next Pull. **[open]**

---

## 6. Pull, merge and Push

### 6.1 Pull

When: app opens, app returns to the foreground (`visibilitychange`), ☰ → Refresh, and as step 1 of every Push. No background polling.

1. `GET /repos/{o}/{r}/git/ref/heads/{branch}` with `If-None-Match: <last ETag>` and `cache: 'no-store'`. 304 or same SHA as `base` → done.
2. Otherwise `GET /git/trees/{commitTree}?recursive=1`, compare each `data/` path's blob SHA with `base`, and fetch only the changed blobs (`GET /git/blobs/{sha}`, raw).
3. Three-way merge (§6.2) of `base`, `current` (this device), `remote`.
4. Write the result to `current`, the remote commit to `base`, any Clashes to `pendingClashes`, and open the resolver if there are any.

### 6.2 Three-way merge (pure function, test-first)

`merge(base, local, remote) → { result, clashes }`, record by record across **all** Projects together (so a move between Projects is just a `parent`/Project change of one Item).

For each Item or Project id:

| base | local | remote | Result |
|---|---|---|---|
| – | has | – | added here: keep |
| – | – | has | added there: keep |
| has | – | – | deleted on both: gone |
| has | – | unchanged | deleted here: gone |
| has | – | content changed | **edit beats Delete**: keep remote; the `deleted` log entry stays |
| has | – | only position changed | gone (a move doesn't save it from a Delete) **[open]** |
| has | both | both | merge field by field ↓ |

Field by field, against base:
- Changed on one side only → take that side.
- Changed on both to the same value → take it.
- **Content fields** `text`, `due`, `crossed` changed differently on both → **Clash** (one per Item, listing the fields). `crossSnap`/`crossedAt` follow `crossed`.
- `type`: if either side made it a Task, it's a Task.
- **Position fields** `parent`, Project, `order`, `bottomed`, `folded` changed differently on both → the side with the later `positionAt` wins (tie: device name order).
- A text edit on one side and a Cross-out on the other are different fields → both apply, no Clash. **[open, agent's reading]**

`index.json`: `projectOrder` entries per Project, later `at` wins; Workspaces per Workspace, membership merged as sets (added on either side stays added, removed on one side and untouched on the other is removed); name later `at` wins.

Change log: union of entries by id. Never a Clash.

**After merging, repair the structure (§2.1) in this order:**
1. An Item whose parent is gone (deleted on one side, a child added on the other) → bring the parent chain back from the Change log entry or base (edit beats Delete).
2. A cycle (A moved under B here, B under A there) → undo the earlier of the two moves.
3. A Note left at top level or under a Note (e.g. after a Note → Task was clashed) → turn its parent into a Task if the parent is a Note; if top level, turn the Note into a Task. **[open]**
4. Two siblings with the same `order` key → regenerate a key for the one with the later `positionAt`.
5. A child added under a Task that was crossed out on the other side → the child stays open; the parent stays crossed out and shows progress. **[open]**

### 6.3 Push

Disabled while offline, while Clashes are pending, or with no token.

1. **Pull** (§6.1). If Clashes appear, stop and open the resolver.
2. Work out the files that differ from `base` (deterministic JSON makes this a byte comparison) and regenerate `readable/` for touched Projects (§3.4).
3. `POST /git/trees` with `base_tree` = base commit's tree and the changed files inline (`content`), deleted paths with `sha: null`.
4. `POST /git/commits` with parent = base commit and the automatic message: `<device>: <Project titles touched> (<N> changes)`, e.g. `Phone: Grant proposal, Teaching (5 changes)`. Fold-only Pushes say `(folds only)`.
5. `PATCH /git/refs/heads/{branch}` with `force: false`.
6. Success → new commit becomes `base`, badge goes to 0. **Rejected (409/422, the other device pushed in between)** → back to step 1, up to 3 tries, then a message "Couldn't Push, try again".

Pressing Push while a Pull is running (e.g. the automatic one on returning to the app) waits for it, then pushes. If the user edits while a Pull or Push is on the network, the incoming data is merged under their new edits (three-way, against the snapshot the call started from), so nothing typed meanwhile is lost. Writes are made one after another (never in parallel). On 403/429 the app waits for `retry-after` and tells the user. On 401 it shows "Token expired or revoked — paste a new one in Settings"; local work is untouched.

### 6.4 Edge cases (from ticket 05) and what happens

| Case | Outcome |
|---|---|
| Laptop and phone edit **different Projects** | Different files; merge silently. |
| Different Items of the **same Project** | Merge silently. |
| Same Item reordered/moved/folded/bottomed on both | Later change wins, no question. |
| Same Item's text / tick / due changed differently | Clash → resolver, at Pull time. |
| Delete on one, text edit on the other | Item stays with the edit; Delete stays in the log. |
| Cross-out on one, text edit on the other | Both apply. **[open]** |
| Other device Pushes while this one is Pushing | Ref update rejected → auto pull, merge, retry. |
| Unpushed edits and the phone clears site data | Prevented by persistent storage; the badge reminds. Nothing else (no timed banners, no "newer remote" warning). |
| Same Project renamed on both | `title` is content → Clash. |
| Change-log entries made on both in the same week | Union; no Clash. |
| Device clocks disagree | "Later wins" uses device time; a wrong clock can pick the wrong side of a position clash. Acceptable for one user. |

---

## 7. Stack, hosting, deploy

- **App**: React + TypeScript + Vite. `vite-plugin-pwa` for the manifest and service worker (the app shell opens offline; Pull/Push need the network).
- **State**: Zustand store over the pure domain functions; every change is written to IndexedDB via `idb`.
- **Order keys**: fractional indexing (small hand-written helper or the `fractional-indexing` package).
- **GitHub**: plain `fetch` with `Authorization: Bearer <token>`, `X-GitHub-Api-Version` header. No SDK.
- **Map**: hand-written layout (measure text → box sizes → column widths → tidy tree), HTML boxes + SVG lines.
- **Tests**: Vitest. Pure modules written test-first: ordering, cross-out/un-cross/bottom/delete/restore, merge, structure repair, changelog week naming, Readable copy, commit message. The GitHub client is tested against a fake `fetch`.
- **Security**: strict Content-Security-Policy (`default-src 'self'; connect-src https://api.github.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'`), no third-party scripts at runtime, links open with `rel="noopener noreferrer"`. The bundle holds no secrets.
- **Hosting**: public repo `PersonalNotes_App` on GitHub Pages at `https://<user>.github.io/PersonalNotes_App/` (Vite `base: '/PersonalNotes_App/'`). A GitHub Actions workflow builds, runs the tests and deploys on every push to `main`. The planning files in `.scratch/` become public with the repo.
- **Data**: private repo `PersonalNotes`, fine-grained token per device in `localStorage`.

Code layout (suggested):

```
src/domain/   model.ts ordering.ts crossing.ts edits.ts merge.ts repair.ts changelog.ts readable.ts   (pure, tested)
src/github/   client.ts pull.ts push.ts
src/store/    db.ts (idb) store.ts (Zustand)
src/ui/       TopBar ProjectList ListView MapView Search ChangeLog Resolver Settings FirstRun
```

---

## 8. Build slices

Each slice is thin and end-to-end, ends with a deployed build, and has a **checkpoint the user tries on laptop and phone**. Pure logic comes first and is written test-first.

**Before slice 1 (user + agent):** create the public `PersonalNotes_App` repo and push this folder to it; create the private `PersonalNotes` repo; the user makes the fine-grained token.

| # | Slice | Contents | Checkpoint (laptop + phone) |
|---|---|---|---|
| 1 | **Shell on Pages** | Vite + React + TS + PWA scaffold, Vitest, CSP, Actions deploy, top bar placeholders. | Open the Pages URL on both; install it on the phone's home screen; it opens offline. |
| 2 | **Outline core (local)** | Test-first: model, ids, order keys, §4.1 ordering, §4.4 edits, structure rules. UI: Project list, Cards List view, add/edit/nest/reorder/indent/fold, due dates, IndexedDB Save. | Make two Projects with Tasks, Subtasks, Notes and due dates; dated ones float to the top; reload — everything is still there. (Each device has its own data for now.) |
| 3 | **Cross out, Delete, Change log** | Test-first: cross/un-cross with `crossSnap`, ↓ bottom, Delete, log entries, restore-the-chain. UI: tick, ⋯ menus, Delete confirmation, per-Project Log and global Change log with Restore / Un-cross. | Tick a parent with a half-done branch, un-tick it (children return as they were); nothing moves until ↓ bottom; Delete a Task and its Project, restore it from the global log. |
| 4 | **GitHub: first run, Pull, Push (one device)** | Settings + first-run, token test, empty-repo init, persistent storage, Pull, Push as one atomic commit, Readable copy, badge, error messages. Until slice 5, Pull refuses to overwrite unpushed local edits when the remote also changed ("merge arrives in the next slice"). | Set up on the laptop, Push; see the commit, `data/` and `readable/` on github.com. Set up on the phone; it Pulls the laptop's Projects. |
| 5 | **Merge and resolver** | Test-first: §6.2 table, field rules, index/log merge, repair cases; push retry. UI: resolver, clash banner. | Edit different Items on both devices → silent merge. Change the same Task's text on both → resolver on Pull. Delete on one, edit on the other → the edit wins. Push from both quickly → second one retries by itself. |
| 6 | **Workspaces, Move, Search** | Workspace picker and settings, membership from both sides, new Project joins current Workspace, Move to Project…, Search with filter and jump. | Make a "Research" Workspace and switch; search a word, tap a result inside a folded branch and land on it. |
| 7 | **Map view (laptop)** | Layout (text measuring, shrink-wrap ≤210px, whole-word wrap, column widths), Workspace/Project/Task/Note boxes, folds, ⋯ menu, edit on the box, zoom/pan/fit, opening zoom rule, top-down switch. | Compare with `map-touch-prototype.html`: same layout, no split words; an edit on the map shows in the List view. |
| 8 | **Map view (phone)** | Pan, pinch, long-press menu + vibration, bigger touch targets, bottom-panel menus, edit on the box with the phone keyboard. | Use the Map on the phone for a real Project: pan, pinch, long-press, edit, tick. |
| 9 | **Polish** | Empty states, offline messages, 401/429 handling, app update prompt (built early, in slice 5: "A new version is ready — Reload", checked on opening and on returning to the app), accessibility pass, dark mode if wanted. | A week of real use on both devices, then a list of fixes. |

---

## 9. Testing

- Every rule in §4 and §6.2 gets a Vitest case before its code. The merge table and the edge-case table above are the test list.
- The GitHub client is tested with a fake `fetch` (304, 409/422 rejection, 401, 429 with `retry-after`, empty repo).
- Manual checkpoints on the real devices close each slice; these also cover what's never been verified: real GitHub calls, persistent storage on Android Chrome, long-press and pinch on a real phone.

---

## 10. Traps from planning (keep these fixed)

- Ticking / crossing out never moves an Item or a Project; Project sort uses all dated Tasks.
- Children are visibly indented with a guide line under their parent card.
- Map box width comes from measuring text; never split a word.
- Confirmations are in-app panels, not `alert`/`confirm`.

---

## 11. Open points (accepted 2026-10-02)

The user answered "ok continue" to the draft. Read as: every point below accepted as written. For #15, which offered two looks, the agent picked the dashed outline to match the Map. Any of these can still be revisited during the build.

From earlier tickets (agent defaults never explicitly confirmed):
1. A **Cross-out on one device and a text edit on the other don't clash**: both apply.
2. **Data files are named by Project id** (renaming a Project doesn't rename its data file; the Readable copy follows the title).
3. The **search icon sits in the top bar**, opening a full-screen search on the phone.
4. A Change-log **Cross-out entry offers "Un-cross"** while the Item is still crossed out.
5. The **stack** in ticket 08: React/TS/Vite, vite-plugin-pwa, idb, Zustand, Vitest.

New in this spec:

6. **Progress** (`2/5`) counts direct children only, not the whole branch.
7. **Un-crossing is not logged** (the log has Crossed out / Deleted / Restored only).
8. **Crossing out a Project** crosses out all its Items too (like any Item), and Un-cross puts them back.
9. **Dragging a dated Item** changes its manual order but it keeps showing in date order while it has a due date.
10. **Indent / Outdent** via ⋯ menu (and Tab / Shift+Tab on laptop); reordering by drag (long-press-drag on phone).
11. **Move to Project** puts the Item at the end of the other Project's top level, so it's offered on Tasks only.
12. **A move doesn't save an Item from a Delete** on the other device (only a content edit does).
13. Merge repair: a Note that ends up at top level becomes a Task; a child added under a Task crossed out on the other device stays open.
14. **Project list rows** show an open-Task count; on the laptop the Project list and the Cards sit side by side.
15. **Notes in the List view** look like the Map's Notes: italic, dashed outline.
16. The **Top-down** map switch is remembered per device.
17. The app can be used **without a token** (local only) until GitHub is set up.
18. A rejected Push retries **up to 3 times** before telling the user.
19. **First connection when both this device and GitHub have Projects**: ask "Keep both" / "Use GitHub's only" (§5.8). *(Added 2026-10-02, after the spec was approved.)*

---

## 12. Decided during the build (all accepted by the user, 2026-10-02)

- **Workspaces** have their own screen (☰ → Workspaces, or the picker's last option "Edit Workspaces…"), not a section in Settings: Settings has a Save button, Workspace edits save at once. Project ⋯ → Workspaces… sets membership from the Project's side.
- **Search:** a result under "Other Projects" switches the picker to All Projects; an empty query shows nothing, also with "Has due date"; switching Workspace closes an open Project that isn't in it.
- **Long-press** opens the ⋯ menu in the List view too (user). A **Subtask** button sits next to + (user).
- **Map:** words are never split, also at hyphens (each run of non-space characters is kept on one line). "+ Project" on the Workspace pill and "Add Task" in a Project's ⋯ make an empty box ready to type into; left empty, it is discarded (not logged). The box being edited is kept in view, also when the phone keyboard opens. A finger that joins a pinch never triggers a long-press.
- **Messages:** a refused token, missing permission or missing repo offers a **Settings** button; a rate limit says when to try again. An **Offline** label shows in the top bar; Push is disabled offline and automatic Pulls wait for the connection.
- **App update:** "A new version is ready — Reload" (built in slice 5 after the user saw a stale version).

## 13. After a week of use (2026-10-05)

- **Laptop shortcuts** (ticket 13; built in 0.10.0), in the List view and the Map view:
  - A mouse click on an Item selects it (outline). Esc or a click on empty space clears it. Touch screens have no selection.
  - **Ctrl+Enter** (⌘+Enter on a Mac) while editing, or with an Item selected: save, then add a same-type sibling (Task → Task, Note → Note) **directly below it**, ready to type. With nothing selected: a new top-level Task in the open Project (List) or the Project last used (Map).
  - **Double-click on empty space** (mouse only): a new top-level Task, ready to type. List: in the open Project. Map: in the Project whose branch is at that height (left → right) or column (top-down), within 30px; otherwise the Project last used.
  - While editing: Enter saves, Shift+Enter is a line break, Esc cancels (a new empty Item is discarded). Ctrl+Enter on a Project name acts like Enter.
  - The keys do nothing while the Change log, Settings, Search, Workspaces, the resolver or any panel is open.

