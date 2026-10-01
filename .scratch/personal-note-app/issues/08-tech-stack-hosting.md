# Tech stack & hosting confirmation

Type: grilling
Status: resolved
Blocked by: 03

## Question

Confirm or change the stack proposed in the original plan, now that the backend facts are known:

- React + TypeScript + Vite; state library (Zustand?); IndexedDB via `idb`; PWA plugin/service-worker approach.
- Library for drawing the Map view tree (hand-rolled SVG vs a tree/graph layout library).
- Where the app is hosted and how it is deployed (e.g. GitHub Pages via Actions), and where the app's source code lives (a separate repo from the `PersonalNotes` data repo?).

## Already decided (2026-10-01, user)

- Two GitHub repos, both created later: **`PersonalNotes_App`** for the app's code and planning, and **`PersonalNotes`** (private) for the notes data only.

## Answer

Resolved with the user, 2026-10-01. Facts: [research/github-backend.md](../research/github-backend.md) §1 and §6.

- **Hosting** (user): **`PersonalNotes_App` is a public repo**, served free by **GitHub Pages** at `https://<user>.github.io/PersonalNotes_App/`, and deployed by a GitHub Actions workflow on every push to `main`. The app code holds no secrets. The notes stay in the private **`PersonalNotes`** repo. Note: the planning files (`.scratch/`, `CONTEXT.md`, prototypes) also become public if they stay in this repo.
- **Token** (user): a **fine-grained personal access token** limited to `PersonalNotes`, with Contents read/write only. It's pasted once per device in Settings and **stored in the app's local storage on that device**, protected by the device lock. No passphrase.
- **Stack** (user: "your call on details"). The agent's picks, to be listed in the spec:
  - React + TypeScript + Vite; `vite-plugin-pwa` for the manifest and service worker (offline app shell).
  - Local data in IndexedDB via `idb`; app state with Zustand.
  - GitHub REST via plain `fetch` (no SDK). The first write to an empty `PersonalNotes` repo uses the Contents API, and every Push after that uses the Git Data API.
  - Map view: hand-written HTML/SVG tree layout as in the prototype (no graph library).
  - Tests: Vitest, mainly for the three-way merge and ordering rules (written test-first).
  - Security: a strict Content-Security-Policy and no third-party scripts at runtime, because the token lives on the app's origin.
