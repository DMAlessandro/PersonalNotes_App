# Item model: notes, tasks, subtasks, and thread ordering

Type: grilling
Status: resolved
Blocked by:

## Question

What exactly is an Item, and how are Items arranged inside a Project?

- Is a Project's List view a **chat timeline** (newest at the bottom, in order of creation) or an **ordered outline** that you can rearrange?
- Can Notes have children, or only Tasks? Can a Task hold a Note under it?
- Is there a limit on how deep Subtasks can nest?
- Can a Note be turned into a Task (and back)?
- When a parent Task is checked, what happens to its Subtasks (and the other way round)?
- What fields does each Item carry (text, created/edited time, checked, colour…)?

## Answer

Resolved with the user, 2026-10-01. Glossary terms updated in `CONTEXT.md`.

- **Ordering:** each Project is an **outline you can reorder**. New Items go to the bottom; you can drag them and indent/outdent them.
- **Nesting:** any Item (Note or Task) can have children of either kind, with **no depth limit**. On a phone the indent stops growing after about 4 levels.
- **Text:** plain multi-line text, with URLs made clickable.
- **Convert:** Note → Task only; never Task → Note.
- **Crossed out** is a single state for every Item and means finished / no longer active. A Task gets it by ticking the box; a Note gets it from its menu. It shows as a line through the text.
  - Crossing out an Item crosses out its **whole branch and folds it**. Before that, children can be crossed out one by one, and the parent shows progress (e.g. 2/5). Un-crossing the parent puts the children back in the state they were in before.
  - A crossed-out Item stays where it is, with a **"to bottom"** button that moves it (and its branch) to the end of its own level. Nothing moves automatically.
- **Delete** is the second, separate step: a deliberate action from the Item's menu that removes the Item and its branch.
- **Change log:** every Cross-out and Delete is recorded with the full content and date. Deleted Items can be restored from it. The log is Pushed to GitHub too. Undo matters a lot to the user.
- **Move:** an Item and its branch can be moved to another Project.
- **Shown on an Item:** created / edited / crossed-out dates in small grey text. Tasks have an optional **due date**.
- Not included: per-Item colour.

### Amendment (2026-10-01, from the List view prototype)

- **Notes live only under a Task.** A Note is never top-level in a Project, never under another Note, and has no children. (This replaces "any Item can hold any Item": only Tasks have children; those children are Tasks or Notes.)
- **Deadline ordering, at every level** (Projects, top-level Tasks, Subtasks): open Items with a due date come first, nearest/overdue on top. Everything else follows in the user's manual order. Crossing out does **not** move an Item (it keeps its place, even in the dated group). Only "↓ bottom" moves it, and that also takes it out of the dated group. *(Revised after the prototype; this replaces the earlier "crossed-out Items leave the top".)*
- **A Project's deadline** = the earliest due date among its open Tasks, at any depth. It has no field of its own.
- **Delete is offered only on a crossed-out Item** (cross out first, then Delete from the menu).
- **Project sort position** (revised from the Map view prototype): based on the earliest due date among all its dated Tasks, ticked or not, ignoring Items sent "↓ bottom". So ticking never reorders Projects. The Project's deadline *chip* still shows the earliest **open** Task.
