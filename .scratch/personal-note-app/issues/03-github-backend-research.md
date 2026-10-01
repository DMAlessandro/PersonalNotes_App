# GitHub as a backend from a static PWA

Type: research
Status: resolved
Blocked by:

## Question

What facts constrain using a private GitHub repo as the only backend of a browser-only PWA (no server of our own)?

- **Auth:** fine-grained PAT limited to one repo vs OAuth web flow vs device flow. Which work from a browser without a proxy (CORS on token endpoints)? Token lifetime/expiry.
- **Writes:** Contents API (one file per commit, needs the file's `sha`) vs Git Data API (blobs/trees/commits, so several files can change in one atomic commit). How do they behave under concurrent writes from two devices?
- **Reads/change detection:** cheapest way to tell whether the remote changed (ETags / conditional requests, ref SHA comparison).
- **Limits:** REST rate limits for authenticated users, and the secondary rate limits on content-creating requests (relevant to commit-per-save), file size limits.
- **CORS:** which api.github.com endpoints can be called from a browser.
- **Hosting:** where the PWA itself can be served over HTTPS (GitHub Pages from a public vs private repo, plan requirements; alternatives such as Cloudflare Pages/Netlify) and whether hosting the app publicly exposes anything if the data repo is private.

## Answer

- **Auth:** only a fine-grained PAT (scoped to `PersonalNotes`, Contents R/W, user-chosen expiry incl. none) works from a pure static PWA. OAuth web/device flows need a token-exchange proxy: `github.com` OAuth endpoints have no CORS and the web flow requires a client secret (SPA/PKCE-without-secret mode is a paused roadmap item). OAuth/App tokens last 8 h, refresh 6 months.
- **Writes:** Contents API = one file per commit, per-file compare-and-swap via `sha` (409 on stale), must be called serially. Git Data API = atomic multi-file commits; ref update is fast-forward-only, so any remote change rejects the push.
- **Change detection:** poll the branch ref SHA with `If-None-Match`; 304s do not count against the primary limit. No webhooks without a server.
- **Limits:** 5,000 req/h; secondary 80 content-creating req/min and 500/h, writes 5 points each (900/min), serial with ≥1 s gap. Commit-per-keystroke is not viable. Contents GET full up to 1 MB; dir listing 1,000 files.
- **CORS:** all `api.github.com` endpoints allow `*` with ETag exposed.
- **Hosting:** GitHub Pages free only from a public repo (Pro for private source); site is public either way unless Enterprise Cloud. Cloudflare Pages/Netlify are free alternatives. A secret-free public bundle exposes no data; the risk is XSS/supply chain on the token-holding origin.

Full findings with sources: [research/github-backend.md](../research/github-backend.md)
