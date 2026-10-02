# Handoff — PersonalNote app

**Who this is for.** Any new Claude chat (any account) continuing the planning or build of this app. If the chat only edits one ticket or one file, read §3 and §4 and skip the rest.

**Deliberately not restated here:**
- `.scratch/personal-note-app/map.md` holds the destination, the standing notes, one line per decision, and scope. It is the index.
- `.scratch/personal-note-app/issues/NN-*.md` holds each decision in full, under its `## Answer`.
- `CONTEXT.md` is the glossary. Use its terms (Project, Item, Task, Note, Subtask, Workspace, Crossed out, Delete, Change log, Push, Pull, Clash…).
- `.scratch/personal-note-app/research/github-backend.md` holds the GitHub API facts, with sources.
- `.scratch/personal-note-app/prototypes/*.html` are throwaway mock-ups that serve as primary sources.
- `PersonalNote_Plan.md` is the user's original plan. Much of it is **superseded** by the tickets; when they disagree, the tickets win.

---

## 1. Primary Goal

A personal notes/tasks PWA for one user (a researcher) on a Windows laptop and an Android phone. It works like a messaging app (Projects → Tasks → Subtasks/Notes), has a Map view (an automatic tree of a Workspace), and stores its data as files in the user's private GitHub repo with a manual **Push** button. The buildable spec (`.scratch/personal-note-app/spec.md`) is written and approved; the build follows its slices (§8). The user wants to review every decision; never settle a user-facing choice alone.

## 2. Completed Work

- **Planning ("wayfinder" method):** all 12 tickets are resolved. **`spec.md` approved 2026-10-02** (user: "ok continue", read as accepting all 18 open points in its §11; #15 Notes in List view = dashed outline, agent's pick).
  - Ticket conventions: each file has `Type:`, `Status: open|claimed|resolved` and `Blocked by: NN`. A resolution goes under `## Answer`, plus one gist line in `map.md` → "Decisions so far".
  - With the `mattpocock-skills` plugin, run `/wayfinder .scratch/personal-note-app/map.md`. Without it, follow these conventions by hand.
- **Prototypes:**
  - `list-view-prototype.html`: variant C (Cards) won.
  - `map-view-prototype.html`: layouts compared.
  - `map-touch-prototype.html`: the latest and most faithful; it has the box-sizing and touch rules.
  - To view a prototype locally, double-click it. Add `?phone` to the touch prototype's URL to force phone mode.
  - A published copy of the touch prototype is private to the original Claude account, so other accounts can't open it. Use the local file.
- **GitHub (2026-10-02):** public `DMAlessandro/PersonalNotes_App` (this folder, `origin`) and private `DMAlessandro/PersonalNotes` (empty) exist. Pages deploys via `.github/workflows/deploy.yml` (test → build → deploy) to https://dmalessandro.github.io/PersonalNotes_App/. The fine-grained token is **not made yet** (user's step, needed by slice 4).
- **Slice 1 (Shell on Pages) built and deployed:** Vite 8 + React 19 + TS 7, vite-plugin-pwa (generateSW), Vitest, production-only CSP meta (`vite.config.ts`), PNG icons from `scripts/make-icons.mjs`, top bar placeholders (`src/ui/TopBar.tsx`). On phones the badge shows the bare count and Push says "Set up". Checked by screenshots at 360/412px and laptop width; **not yet checked by the user on the phone** (install + offline).
- **Slice 2 (Outline core, local) built and deployed 2026-10-02:** pure domain in `src/domain/` (model, fractional `orderKey`, `ordering`, `edits`, `structure`; 41 Vitest tests), IndexedDB Save (`src/store/db.ts`) + Zustand (`store.ts`, `ui.ts`), UI in `src/ui/` (ProjectList, ProjectView cards, ItemNode, Panel, TextEditor, useDrag). Checked with a Playwright script driving Edge (laptop and 412px). Choices made: editing starts with double-click/double-tap or menu -> Edit (as in the touch prototype); drag uses a handle on both devices (not long-press-drag); tick boxes are shown but disabled until slice 3; the unpushed badge stays 0 until slice 4.
- The user did the slice-1 phone checkpoint: installed and offline both work.

## 3. Active Decisions & Constraints

Each decision's detail is in its ticket. These are the ones a fresh chat is most likely to break:

- **Ticking/crossing out never moves anything,** including Projects. The user had to say this twice. Only the "↓ bottom" button moves a crossed-out Item. A Project's *sort position* uses all its dated Tasks, ticked or not. Its *chip* shows the earliest open deadline. (Ticket 01 amendment, ticket 06.)
- **Delete is offered only on an already crossed-out Item.** Cross out, then Delete. Everything goes to the weekly Change log and can be restored.
- **Notes live only under a Task.** Only Tasks have children.
- **Map boxes show their full text and never split a word.** They shrink-wrap the text up to ~210px and grow wider rather than break a word. Text is edited directly on the box, also on the phone.
- **Saving is local and automatic; GitHub is updated only by a manual Push.** One Push = one atomic commit (Git Data API). The app pulls on open/foreground and before each Push. Merging is per Item, three-way.
- **Two repos (user):** public `PersonalNotes_App` (code + these planning files, served by GitHub Pages) and private `PersonalNotes` (notes data only). The token is a fine-grained PAT limited to `PersonalNotes`, stored per device.
- **Reversals** (the earlier answer is wrong now):
  - "Any Item can hold any Item" → only Tasks have children.
  - "Crossed-out dated Items leave the top" → they stay put.
  - "Top-down map on phone" → left → right everywhere (top-down is only a manual switch).
  - "Bottom-panel editing on phone" → edit on the box.
  - "Monthly change log" → weekly files.
  - "Mind map = message type / free canvas" (original plan) → automatic tree view of a Workspace.
- **Spec open points** (spec §11) were accepted wholesale with a short "ok continue". If the user later objects to one, treat it as a change, not a mistake, and update the spec.
- **Never verified:**
  - Any real GitHub API call.
  - That Android Chrome grants persistent storage to the installed PWA.
  - Long-press and pinch on a real device. The user tried the touch prototype and said it works well, but nothing was measured.

## 4. Failed Approaches / Traps to Avoid

- **Prototype bugs the user caught:**
  - Crossing out moved Items. In the List prototype, a crossed dated Item dropped out of the deadline group. In the Map prototype, a Project's position followed its *open* deadline. Both were fixed, and the spec must keep both fixes.
  - The Cards layout didn't indent first-level children, so a sibling Note looked like a child of the Task above. Children must be clearly indented with a guide line.
  - Fixed-width map boxes split words, because the controls ate the text column. Box width must come from measuring the text, not from a constant.
- **Published Claude artifacts** have no `alert`/`confirm`/`prompt` (they return null/false silently) and no query string. Build confirmations in-page.
- **Headless Edge** can't make a window narrower than ~500px, so a 412px screenshot is misleading. Force phone mode instead.
- **The user answers in short, sometimes ambiguous phrases.** Restate your reading and record what you assumed. Several answers looked like a choice but actually introduced a new rule (Workspaces, two-step delete, deadline ordering).

## 5. Exact Next Step

1. Slice 2 checkpoint: the user liked it and asked for long-press menus on touch and a Subtask shortcut next to + (both done 2026-10-02, recorded in spec 4.4 / 5.2). Wait for them to try these on the phone.
2. Then build **slice 3 - Cross out, Delete, Change log** (spec section 8), test-first in `src/domain/`: cross/un-cross with `crossSnap`, down-to-bottom, Delete (only when crossed), Change-log entries per ISO week, restore-the-chain. UI: enable the tick box, menu entries, in-app Delete confirmation, per-Project Log and global Change log.

Tooling note: long heredocs in the Bash tool sometimes fail with "unexpected EOF"; use the Write tool for new files.

---

## Maintaining this file

- Update it at the end of each working session.
- §1 rarely changes.
- §2 and §5 are replaced in place.
- In §3, keep live rules only; add each reversal as "earlier X → now Y".
- §4 is append-only, unless a trap becomes impossible.
- Never paste ticket content here; point at the ticket.
- Keep it to about a page.
