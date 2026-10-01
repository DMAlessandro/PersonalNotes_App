# Sync & conflict policy

Type: grilling
Status: resolved
Blocked by: 04

## Question

When does the app sync, what counts as a conflict, and what can the user do about one?

- When to pull: on app open, on focus, periodically, before each push?
- What is a conflict: same file changed on both sides, or the same Item changed on both sides? Can changes to different Items merge automatically?
- Which resolver choices survive from the original plan (keep local / keep remote / merge / add missing / edit either), and which are overkill for one user on two devices?
- What happens to queued offline edits that hit a conflict?

## Answer

Resolved with the user, 2026-10-01.

**Pull (fetch the other device's Pushes):** automatically when the app opens or returns to the foreground, and always right before a Push. Plus a "Refresh" in the menu. No background polling. (Cheap check: compare the branch's commit SHA with an ETag, see the research.)

**Merging is per Item, against the last pulled version (three-way)** (user):
- Changes to **different Items**, even in the same Project, merge silently.
- **Position-only clashes** on the same Item (order, indent, move to another Project, fold, "to bottom") merge silently: the **later change wins**. This needs a "last changed" time per Item for position and for content.
- **Delete on one device vs text edit on the other → the edit wins automatically** (user). The Item comes back and the Delete stays in the Change log. *Agent's reading, to confirm while writing the spec:* a Cross-out on one side and a text edit on the other don't clash. Both apply (the Item ends up crossed out with the new text).
- **The same Item's text, tick or due date changed differently on both** → the resolver.

**Resolver** (user): one clash at a time, side by side, with **Keep this device's / Keep the other's / Keep both** ("both" adds the other version as a sibling Item). It appears **as soon as a Pull finds clashes** with unpushed edits, not later at Push time.

**Push:** pull → merge → (resolver if needed) → one atomic commit. If GitHub rejects it because the other device pushed in the meantime, the app pulls, merges and retries automatically.

**Protecting unpushed work** (user): the **"N unpushed" badge is always visible** next to Push, and on first run the app **asks the browser for persistent storage**, so Android doesn't clear local data. No timed reminder banner, and no "newer remote" warning.
