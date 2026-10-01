# Tech stack & hosting confirmation

Type: grilling
Status: open
Blocked by: 03

## Question

Confirm or change the stack proposed in the original plan, now that the backend facts are known:

- React + TypeScript + Vite; state library (Zustand?); IndexedDB via `idb`; PWA plugin/service-worker approach.
- Library for drawing the Map view tree (hand-rolled SVG vs a tree/graph layout library).
- Where the app is hosted and how it is deployed (e.g. GitHub Pages via Actions), and where the app's source code lives (a separate repo from the `PersonalNotes` data repo?).

## Already decided (2026-10-01, user)

- Two GitHub repos, both created later: **`PersonalNotes_App`** for the app's code and planning, and **`PersonalNotes`** (private) for the notes data only.
