# Copy an Item's text to the clipboard

Type: grilling
Status: resolved
Blocked by: 01

## Question

How does the user copy the text of one Task, Subtask or Note, to paste it elsewhere (e.g. as a prompt in a Claude chat)?

## Answer

Requested by the user, 2026-10-12 ("a line in the menu … for copying the text of that specific selected note, task, or subtask to the clipboard, laptop or mobile").

- Item ⋯ menu gets **Copy text**, right after Edit, for Tasks, Subtasks and Notes, in the List view and the Map view (shared menu).
- It copies **only that Item's text**, exactly as written (line breaks kept). Not the Items under it, not the due date. *(Agent's reading of "that specific" Item; to be confirmed by the user.)*
- A short **"Copied"** toast confirms it; if the browser blocks the clipboard, an error toast says so.
- Projects' ⋯ menu has no Copy (not asked).

## Comments

- 2026-10-12: built in app 0.12.0 (`src/ui/clipboard.ts`: Clipboard API with a hidden-textarea fallback; entry in `useItemMenu`). Playwright on Edge, laptop and 412px phone emulation: Task text with a line break and a Subtask's text read back from the clipboard, toast shown, no page errors. **Not yet checked by the user on the real phone.**
