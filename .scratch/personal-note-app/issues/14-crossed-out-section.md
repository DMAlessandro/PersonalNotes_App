# Crossed-out Items go to a folded section at the bottom

Type: grilling
Status: resolved
Blocked by: 01, 07

## Question

Should crossing out move an Item out of the way, and how are crossed-out Items shown?

## Answer

Resolved with the user, 2026-10-08 (request raised by the user). **Reverses** "crossing out never moves anything" (ticket 01 amendment) and replaces the "↓ bottom" button.

- Crossing out a Task or Note **always** moves it to the bottom of its level, dated or not, and its text gets smaller.
- Each level (a Project's top level, each Task's children) ends with a **separator line** when it has crossed-out Items. The line is pale grey, low contrast, with a small arrow (▾) and no label. It starts **folded**; clicking it shows the crossed-out Items below it (▴).
- An opened section stays open **until you leave the Project** (or reload). It's per device, not Pushed.
- **Projects too**: crossed-out Projects go under the same kind of line at the bottom of the Projects list.
- **Map view**: crossed-out Items and Projects are **not shown**.
- Un-cross puts the Item back where it was (its manual order is kept). "↓ bottom" is removed.

## Comments

- 2026-10-08: built in app 0.11.0 (`splitCrossed` and the new sort groups in `src/domain/ordering.ts`, test-first; `src/ui/CrossedSection.tsx`; `src/map/tree.ts` leaves crossed out). Playwright on Edge, laptop and 412px phone emulation: 17 checks.
