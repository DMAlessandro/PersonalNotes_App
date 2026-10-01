# Map view look & editing

Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

What should the Map view of a Workspace look like and how should editing on it feel?

Build a rough throwaway mock (fake data, no sync) of a Workspace with 2–3 Projects as boxes, each with Tasks/Subtasks as branches that expand and collapse. React to:

- Layout direction (left→right tree, top→down, radial).
- How to add a box, edit text, check a Task, collapse a branch.
- How crossed-out Items and Notes appear on the map (or whether Notes appear at all).
- Whether boxes can be dragged, or the layout is always automatic.

## Answer

Resolved with the user, 2026-10-01. Prototype (primary source, throwaway): [prototypes/map-view-prototype.html](../prototypes/map-view-prototype.html). It opens in "Auto"; variants A, B and C are kept for reference.

- **Layout: left → right tree by default on both laptop and phone** (Workspace on the left, branches flowing right). The user changed this from "top-down on phone" after trying it. Top-down stays available as a manual layout switch. Radial (C) is rejected.
- **Always automatic placement.** No dragging boxes, and no positions to save. Order follows the same rules as the List view (deadline first, then manual order). Folds are shared with the List view.
- **Readable on opening:** the map never opens zoomed out below about 12px text (scale 0.85 of 14px). If everything fits at that size, it's centred. If not, it starts at the top-left and the user pans. Manual zoom may go further out. Laptop: drag the background to pan, wheel to zoom, a "fit" button.
- **Boxes:** the Workspace root is a pill with "+ Project". Projects are tinted boxes. Tasks are cards with a tick box, due chip and progress (n/m). **Notes are shown as small dashed, italic boxes.** A folded branch shows "+N" hidden.
- **Editing on the map** = the same edits as in the List view (checked via the Map ↔ List switch). The ⋯ menu offers: + Task under, + Note under (Tasks only), Edit/Rename, Set due date, Note → Task, Cross out / Un-cross. **To bottom and Delete appear only after crossing out.**
- **Ticking never moves anything** (user, repeated). For this, a Project's *sort position* uses all its dated Tasks, ticked or not, and ignores only Items sent "↓ bottom". Its *deadline chip* still shows the next open deadline.
- The prototype's pop-up text boxes for adding and editing are a shortcut, not the design. Inline editing on the box is assumed for the spec.
