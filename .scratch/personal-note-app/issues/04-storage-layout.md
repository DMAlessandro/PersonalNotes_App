# Repo storage layout & commit granularity

Type: grilling
Status: resolved
Blocked by: 01, 03

## Question

How is the data laid out in the `PersonalNotes` repo, and when is a commit made?

- One file per Project, one file per Item, or one file for everything? Where do Workspaces and the Change log live?
- Is the format JSON or Markdown that you can read on github.com?
- ~~Commit on every save, or batch edits?~~ Settled: local saves are automatic, and a manual **Push** sends changes to GitHub. Still open: does one Push become a single atomic commit (Git Data API) or one commit per changed file (Contents API)?
- What commit messages does a Push use?

The layout decides how often two devices actually collide, so it shapes the conflict policy.

## Answer

Resolved with the user, 2026-10-01. Research facts used: [research/github-backend.md](../research/github-backend.md).

Repo `PersonalNotes` layout:

```
data/index.json                  Workspaces (name + Project ids) and the single manual Project order
data/projects/<projectId>.json   one file per Project: the Project and its whole Item tree
                                 (text, type, crossed + dates, due, fold state, "sent to bottom", manual order)
data/changelog/<YYYY>-W<ww>.json Change log, one file per ISO week (Cross-outs and Deletes, full content, restorable)
readable/<Project title>.md      generated on every Push: a formatted Markdown page per Project for github.com, read-only
```

- **One file per Project** (user). Laptop and phone editing *different* Projects never collide.
- **Data is JSON; a readable Markdown copy is regenerated on each Push** (user). Edits are made only in the app. Hand edits to `readable/` are overwritten.
- **Change log: one file per week** (user's choice, over the proposed monthly files). It lives outside the Project files, so it survives a Project being Deleted. Past weeks are never rewritten.
- **One Push = one atomic commit** (user). Uses the Git Data API: blobs → tree on top of the last known commit → commit → move the branch. It's all-or-nothing. If the remote moved since the last pull, GitHub rejects it (fast-forward only). That's the hook for the sync & conflict policy.
- **Commit message is automatic** (user): device name + Projects touched + number of changes, e.g. `Phone: Grant proposal, Teaching (5 changes)`. Device name is set once per device.
- **Fold changes ride along silently** (user). They're saved and included in the next Push, but don't count in the "N unpushed" badge.
- Data files are named by a stable Project id, so renaming a Project doesn't rename its data file. The readable copy follows the title. *(This was the agent's default and was mentioned to the user, not separately decided.)*
