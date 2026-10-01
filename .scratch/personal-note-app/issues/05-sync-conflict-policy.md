# Sync & conflict policy

Type: grilling
Status: open
Blocked by: 04

## Question

When does the app sync, what counts as a conflict, and what can the user do about one?

- When to pull: on app open, on focus, periodically, before each push?
- What is a conflict: same file changed on both sides, or the same Item changed on both sides? Can changes to different Items merge automatically?
- Which resolver choices survive from the original plan (keep local / keep remote / merge / add missing / edit either), and which are overkill for one user on two devices?
- What happens to queued offline edits that hit a conflict?
