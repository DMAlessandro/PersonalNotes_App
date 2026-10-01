# Workspace rules

Type: grilling
Status: resolved
Blocked by:

## Question

How do Workspaces behave?

- Is there a default "All Projects" Workspace? Can a Project belong to no Workspace?
- Does picking a Workspace also filter the Project list / List view, or does it only affect the Map view?
- Is the expanded/collapsed state of branches stored per Workspace, per Project, or per device?
- How are Workspaces created, renamed, deleted, and how are Projects added to or removed from them?
- Does the order/placement of Projects in a Workspace's map matter and need saving?

## Answer

Resolved with the user, 2026-10-01. Glossary updated in `CONTEXT.md`.

- **All Projects:** a built-in Workspace that always exists, can't be deleted, and contains every Project. A Project can belong to none of the user's own Workspaces.
- **Scope:** choosing a Workspace filters **everything**: both the Project list and the Map view show only its Projects.
- **On open:** the app always starts on **All Projects** (it does not remember the last one used).
- **Folding:** expand/collapse is stored **per Item** and applies everywhere: List view, Map view, every Workspace and both devices (it is Pushed).
- **Membership:** set from the Project's menu ("Workspaces…") **or** from the Workspace's settings. A new Project created while a Workspace is selected joins it automatically.
- **Project order:** a single manual order, dragged by the user. Every Workspace shows its Projects in that same order.
- **Project lifecycle:** the same as Items. Cross out (finished, greyed, "to bottom" of the list), then Delete separately from the menu. Both are logged in the Change log and can be restored.
- **Deleting a Workspace:** confirm, then only the selection is removed; its Projects are untouched. Not logged.
- Where Projects sit inside the Map view's drawing is left to the Map view prototype.
