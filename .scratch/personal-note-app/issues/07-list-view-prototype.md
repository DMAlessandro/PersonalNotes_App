# List view look

Type: prototype
Status: resolved
Blocked by: 01

## Question

What should a Project's List view (the chat-like thread) look like?

Build a rough throwaway mock with Notes, Tasks, nested children, crossed-out Items (folded branch, "to bottom" button), progress like 2/5, due dates and small grey dates. React to:

- Chat bubbles vs a plain list.
- How Subtasks are indented and collapsed.
- Where the composer sits and how you pick Note vs Task / add a Subtask.
- How it feels at phone width.

## Answer

Resolved with the user, 2026-10-01. Prototype (primary source, throwaway): [prototypes/list-view-prototype.html](../prototypes/list-view-prototype.html). It opens in variant C; variants A and B are kept there for reference only.

- **Winner: C, Cards.** Each top-level Task is a card: title row, due chip, progress count and progress bar. Its branch is inside, indented with a guide line. Laptop: cards in columns that adapt to the browser window's width (no fixed maximum). Phone: one column.
- **Adding:** a round **+** button opens a bottom panel (type, text, optional due date). At the top level only Tasks can be added. Notes are added with ⋯ → "Add under" on a Task.
- **Item menu (⋯):** Add under (Tasks only), Make Task (Notes only), Cross out / Un-cross, Move to Project…, and **Delete, which appears only once the Item is crossed out**.
- **Crossing out never moves an Item.** It stays where it is, crossed out and folded. Only the **↓ bottom** button moves it, to the end of its level, which also takes it out of the deadline-first group. Un-crossing puts it back in the normal ordering.
- Header: Project title, next deadline chip (red when overdue), "N unpushed" badge, **Push** button, **Log** button (opens the Change log side panel with Restore).
- Fix found while testing: children must be clearly indented under their parent card (a sibling Note was misread as a child).
