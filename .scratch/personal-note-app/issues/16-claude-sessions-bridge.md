# Claude Sessions bridge: Claude Code replies on the phone, on request

Type: grilling
Status: resolved
Blocked by: 04, 05

## Question

How does the user follow (and later answer) Claude Code sessions running on the laptop from the phone, without AnyDesk? Remote Control is disabled by the user's organisation (Sapienza Team plan; `/remote-control` says "disabled by your organization's policy", 2026-10-12).

## Answer

Resolved with the user, 2026-10-12.

- A **Claude Code hook** on the laptop (UserPromptSubmit + Stop), not a feature of the app. The app is unchanged: replies arrive as ordinary data through the PersonalNotes repo.
- **Only on request**, by a tag in the prompt (user: written without spaces):
  - `#phoneon`: every reply of that session goes to the app, until `#phoneoff`;
  - `#phoneoff`: stop;
  - `#phone`: only the next reply.
  - `#phone on` (with a space) counts as plain `#phone`. Lookalikes (`#phonebook`) are ignored. The hook tells Claude to ignore the tag (~40 tokens on a tagged prompt; nothing otherwise).
- In the app: a Project **"Claude Sessions"** (made if missing; a crossed-out one is ignored). **One Task per session** (`<folder> · 12 Oct 17:37`), made at its first delivered reply; **each reply is a Subtask** under it, in order, full text. A crossed-out or deleted session Task gets a fresh one.
- Several sessions at once stay apart by Claude Code's session id. Works for any Claude account using the same Claude Code settings on the laptop.
- Delivery runs in the background (Claude never waits): Pull, add, Push as device "Claude bridge", reusing the app's engine, so a Push from the phone in between merges like any other device. Own fine-grained token (the app's token can be reused) in the bridge's `config.json`.
- **Answering from the phone (phase 3)**: in a `#phoneon` session, write a **Note under a reply** (or under the session Task) and **Push**. A background waiter (second Stop hook, `asyncRewake`) polls GitHub every 15 s and wakes the idle session with the Note as the next message. Notes only: the bridge itself only makes Tasks. A Note containing `#phoneoff` also switches the session off. The waiter steps aside when the user types at the laptop, when a newer reply starts a newer waiter, after `#phoneoff`, or after `waitMinutes` (config, default 55). Each Note is sent once.

## Comments

- 2026-10-12: phase 1 (tag only, local outbox) passed with two real sessions. Phase 2 built: `src/bridge/claudeSessions.ts` + `deliver.ts` (test-first, 9 tests with FakeGit, incl. a phone Push during delivery), `bridge/cli.ts` (bundled to `deliver.mjs` by `scripts/build-bridge.mjs`), `bridge/hook.mjs`. Verified on a throwaway branch of PersonalNotes (deleted), then by the user on `main`: replies seen on the phone. Runs from `C:\Users\9alex\Desktop\ClaudeAle\phone-bridge-test` (test folder, by the user's choice).
- Claude Code auto mode refuses to edit `~/.claude/settings.json`; the user runs `node install-global.mjs` in the bridge folder instead.
- 2026-10-12: phase 3 built. `src/bridge/answers.ts` (test-first), `deliver.mjs --wait`. Chosen over a blocking Stop hook (first sketch) because `asyncRewake` leaves the terminal free. Verified on a throwaway branch (deleted): reply delivered, a Note written as the phone would, waiter exited 2 with the answer about 9 s later; typing at the laptop stopped a waiter; a sent answer was not resent. **Not yet verified: the real wake-up inside Claude Code** (needs the user's run). The documented hook timeout has no stated maximum; ours is 3600 s.
