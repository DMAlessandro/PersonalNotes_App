# Map: PersonalNote App

Label: wayfinder:map

## Destination

A buildable spec at `.scratch/personal-note-app/spec.md`: every design decision locked and the build split into slices, ready to hand to an implementation session. Source material: `PersonalNote_Plan.md` (kept as is).

## Notes

- Domain: personal notes/tasks PWA, data stored in the user's private GitHub repo. Glossary: `CONTEXT.md`. Use its terms.
- **Every decision is reviewed with the user.** HITL tickets are never resolved by the agent alone.
- Each session calls the `grilling` and `domain-modeling` skills and updates `CONTEXT.md` when a term changes.
- Charting decisions (standing):
  - Single user, two devices: Windows laptop + Android phone.
  - PWA only, used like a webpage, with data in the user's GitHub.
  - Every edit is saved locally on the device, automatically and always. Sending changes to GitHub is a manual **Push** button the user presses when they choose (decided 2026-10-01, after the GitHub research). The conflict resolver is in v1.
  - The Map view is a visual aid: no manual links between boxes. Boxes are Projects with their Tasks/Subtasks as a tree you can expand and collapse. Edits made in the Map view (new box, new or edited text) are the same edits as in the List view.
- GitHub repo for the data: private repo `PersonalNotes` (from the original plan).

## Decisions so far

<!-- one line per resolved ticket: [name](issues/NN-slug.md): gist -->
- [GitHub as a backend from a static PWA](issues/03-github-backend-research.md): only a fine-grained PAT works with no proxy (OAuth endpoints lack CORS); Contents API = per-file CAS commits, Git Data API = atomic multi-file commits; poll ref SHA with ETag; ~500 writes/h cap; Pages is free only from a public repo and the app bundle holds no secrets.
- [Item model: notes, tasks, subtasks, and thread ordering](issues/01-item-model.md): reorderable outline; only Tasks have children (Tasks or Notes; Notes always sit under a Task), no depth limit; open dated Items are sorted first, nearest on top, at every level (a Project's deadline = its earliest open Task); one "Crossed out" state (tick or menu) that folds the branch, then a manual "to bottom"; Delete is a separate step; a restorable Change log covers both; Note → Task only; move between Projects; dates + Task due date.
- [Workspace rules](issues/02-workspace-rules.md): built-in All Projects (the default on open); a Workspace filters both views; folds are stored per Item everywhere; membership is set from either side and new Projects join the current Workspace; one manual Project order; Projects cross out/delete like Items; deleting a Workspace leaves its Projects untouched.
- [List view look](issues/07-list-view-prototype.md): Cards layout (adaptive columns on laptop, one on phone); + button opens an add panel; Delete only appears after Cross out; crossing out never moves an Item, only "↓ bottom" does.
- [Map view look & editing](issues/06-map-view-prototype.md): left→right tree by default on laptop and phone (top-down as a manual switch), always placed automatically; opens no smaller than ~12px text (pan for the rest); Notes shown as small dashed boxes; the same ⋯ edits as the List view; ticking never moves anything (Project sort uses all its dated Tasks).
- [Repo storage layout & commit granularity](issues/04-storage-layout.md): JSON file per Project + index.json (Workspaces, Project order) + weekly Change log files; readable Markdown copy regenerated on every Push; one Push = one atomic commit with an automatic message; fold changes ride along without counting as unpushed.

## Not yet specified

- Change log screen: where it lives (per Project or global), how to browse and restore from it.
- Due dates: reminders/notifications on the phone, and an "upcoming" overview across Projects (or none).
- Conflict-resolver screen details: layout and wording (after the sync & conflict policy ticket).
- Touch interactions in the Map view on a phone: pinch-zoom, tap vs long-press for the ⋯ menu, inline text editing on a box.
- Search across Projects.
- How the GitHub token is stored and secured on each device.
- Export/backup beyond the GitHub repo itself.
- Splitting the final spec into build stages (the last step before the destination).

## Out of scope

- Native installers (Capacitor for Android, Tauri for Windows): the PWA is enough.
- Collaborators / multiple users.
- Manual links/lines between boxes in the Map view.
- Full offline-first operation.
