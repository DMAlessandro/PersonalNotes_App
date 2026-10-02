# Write the buildable spec and build slices

Type: task
Status: resolved
Blocked by: 09, 10, 11

## Question

Turn every resolved ticket into `.scratch/personal-note-app/spec.md`: the data model, the screens (Cards List view, Map view, Change log, Search, resolver, Settings/token), the sync rules, the repo layout and the stack. Then split the build into vertical slices, each ending in a checkpoint the user can try on laptop and phone. The user reviews the spec before it counts as done.

## Answer

Resolved with the user, 2026-10-02. The spec is [spec.md](../spec.md): data model and repo files, ordering/crossing/deleting rules, every screen, Pull/merge/Push with edge cases, stack and deploy, and 9 build slices. The user approved the draft with "ok continue", read as accepting all 18 open points in §11 as written. For #15 (how Notes look in the List view), the agent picked the dashed outline to match the Map.
