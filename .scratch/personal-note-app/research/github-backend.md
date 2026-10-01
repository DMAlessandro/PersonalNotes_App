# GitHub as a backend from a static PWA

Research for ticket [03](../issues/03-github-backend-research.md). Researched 2026-10-01 against GitHub's own docs, changelog and roadmap, plus one live probe of the endpoints. This file gives facts and trade-offs only. The decisions belong to tickets 04 (storage layout), 05 (sync and conflict policy) and 08 (tech stack and hosting), and to the user.

Setting: one user, a Windows laptop and an Android phone, a browser-only PWA with no server of our own, and data in the private repo `PersonalNotes`.

---

## 1. Auth

### Fine-grained personal access token (PAT)
- A fine-grained PAT can be limited to **only selected repositories** ("Only select repositories", then pick from the dropdown) and given narrow permissions. For this app that would be **Contents: read and write** on `PersonalNotes` only. Metadata: read-only is always included. Source: [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
- Expiry: the default is 30 days. The user chooses the expiry, and "infinite lifetimes are allowed but may be blocked by a maximum lifetime policy" set by an org or enterprise owner. A personal account has no such policy. GitHub recommends fine-grained tokens over classic ones "whenever possible". Same source.
- The rule that deletes tokens unused for a year applies to **classic** tokens. Same source.
- From a browser this needs no OAuth exchange at all. The user pastes the token once on each device and the app sends it as `Authorization: Bearer <token>` to `api.github.com`, which allows CORS (see section 5). This is the only option that works today with no proxy.
- Trade-off: the token sits in browser storage (IndexedDB or localStorage) on both devices, readable by any script running on the app's origin. Its blast radius is limited to the repo and permissions the user picked. GitHub's own advice on storing tokens is aimed at CLI and Actions use and does not cover browsers. How to store the token is already listed under "Not yet specified" in the map.

### OAuth app or GitHub App, web flow (authorization code)
- Steps: redirect to `github.com/login/oauth/authorize`, receive the redirect back with a `code`, exchange the code at `POST github.com/login/oauth/access_token`. The token exchange lists **`client_secret` as Required**. Source: [Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps). GitHub App user tokens work the same way: [Generating a user access token for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).
- PKCE (`code_challenge` with `S256`) has been supported and recommended since July 2025. Source: [Changelog 2025-07-14](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/). PKCE does **not** remove the need for the client secret, and it does not add CORS.
- **CORS:** the authorization docs say "CORS pre-flight requests (OPTIONS) are not supported" on these endpoints. A public-client SPA mode would drop the client secret, require PKCE, and turn on CORS on `/access_token` for redirect URIs marked as SPA. That mode is on GitHub's roadmap as **"Preview", status "Paused"**, with no date: [github/roadmap#1153](https://github.com/github/roadmap/issues/1153).
- Live probe on 2026-10-01: `OPTIONS` and `POST` to `github.com/login/oauth/access_token` and `github.com/login/device/code` with an `Origin` header returned no `Access-Control-Allow-Origin` header. `api.github.com` returned `Access-Control-Allow-Origin: *`.
- **So a pure static PWA cannot complete the OAuth web flow.** It needs a small token-exchange proxy, such as a serverless function that holds the client secret. That would be "a server of our own", however small.
- Expiry: with expiring tokens enabled (always for GitHub Apps by default), access tokens last **8 hours** and refresh tokens last **6 months**. Refreshing also goes through the `/access_token` endpoint, so it needs the proxy too. GitHub App user tokens can be narrowed to one repo with `repository_id`, and the app can be installed on `PersonalNotes` only. OAuth-app `repo` scope covers **all** of the user's repos. Sources: the two docs above.

### Device flow
- Endpoints: `POST github.com/login/device/code`, then poll `POST github.com/login/oauth/access_token`. It must be enabled in the app settings, and no client secret is needed. Source: [Authorizing OAuth apps, device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow).
- Both endpoints are on `github.com`, which has no CORS (probe above). So the device flow from a browser **also needs a proxy**. It suits CLIs and native apps, not a static PWA.

### Summary table

| Option | Works from static PWA with no proxy? | Scope to one repo | Lifetime |
|---|---|---|---|
| Fine-grained PAT | Yes | Yes (selected repos, Contents R/W) | User-chosen, up to no expiry |
| OAuth app web flow (+PKCE) | No: secret needed and no CORS on `/access_token` | No (`repo` = all repos) | Non-expiring, or 8 h / 6 mo refresh |
| GitHub App web flow | No (same reason) | Yes (install on one repo, `repository_id`) | 8 h access / 6 mo refresh |
| Device flow | No (no CORS on `github.com`) | Depends on app type | Same as above |
| SPA mode (CORS + PKCE, no secret) — roadmap only, paused | Would be yes | Same as GitHub App | Refresh possibly ~24 h |

---

## 2. Writes

### Contents API: `PUT /repos/{owner}/{repo}/contents/{path}`
- **One file per commit.** Every create, update or delete makes one commit.
- Updating needs `sha`: "The blob SHA of the file being replaced." If that `sha` is out of date, the call returns **409 Conflict**. This is a built-in compare-and-swap **per file**. Source: [Repository contents](https://docs.github.com/en/rest/repos/contents).
- The docs warn that using this endpoint and "Delete a file" in parallel causes conflicts and errors, and say to call them **serially**. Same source.
- Two devices, same file: the second writer gets 409 and has to re-read and merge. Two devices, different files: both succeed, and GitHub chains the commits on the branch.
- A change that touches several files, such as an Item file plus an index or Workspace file, takes several commits and is **not atomic**. A failure or a lost connection part-way leaves the repo half-updated.

### Git Data API (blobs, trees, commits, refs)
- Flow: read the ref, get the commit and its tree, create blobs, create a tree with `base_tree`, create a commit with the old commit as parent, then `PATCH` the ref. Sources: [Git database guide](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database), [Trees](https://docs.github.com/en/rest/git/trees), [Commits](https://docs.github.com/en/rest/git/commits), [Refs](https://docs.github.com/en/rest/git/refs).
- **Any number of files change in one atomic commit.** In a tree, `sha: null` deletes a path. Entries in `tree` overwrite matching paths from `base_tree`.
- Concurrency: "Update a reference" has `force`, default `false`, and with false it only moves the ref by fast-forward ("make sure you're not overwriting work"). If another device moved the branch in the meantime, the update is **rejected** (the docs list 409/422). This is a compare-and-swap on the **whole repo head**: any remote change, even to unrelated files, forces a rebase or merge before pushing.
- Cost: about 3 + N requests per save (N blobs, or inline content in the tree, then commit, then ref), against 1 for the Contents API. All the POSTs are writes (see section 4).
- Empty repos: the Git database API returns 409 on an empty repo. The repo must first be initialised, for example with a first Contents API write. Source: Git database guide.

---

## 3. Reads and change detection

- **Conditional requests:** responses carry an `ETag` (and sometimes `Last-Modified`). Sending `If-None-Match` or `If-Modified-Since` returns **304 when nothing changed, and a 304 does not count against the primary rate limit**. Source: [Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).
- `ETag` is in the CORS-exposed headers, so browser JS can read it. Source: [CORS doc](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests). Live probe: the response also had `Cache-Control: max-age=60` (public repo). The browser HTTP cache may answer for itself within that window, so the app can send `cache: 'no-store'`, or its own `If-None-Match`, when it needs to be sure.
- **Cheapest "did anything change?" check:** `GET /repos/{o}/{r}/git/ref/heads/{branch}` (Get a reference) and compare the commit SHA with the last synced SHA, sent with `If-None-Match`. The answer is one small response, or a free 304. Source: [Refs](https://docs.github.com/en/rest/git/refs).
- **What changed:** compare commits (`/compare/{base}...{head}`) or fetch the new tree recursively (`GET /git/trees/{sha}?recursive=1`, limited to **100,000 entries / 7 MB**, with a `truncated` flag) and diff blob SHAs against local ones. Source: [Trees](https://docs.github.com/en/rest/git/trees).
- Directory listing through the Contents API stops at **1,000 files** per directory. Past that, use the Trees API. Source: [Repository contents](https://docs.github.com/en/rest/repos/contents).
- GitHub prefers webhooks to polling. Webhooks need a server to receive them, so a static PWA can only poll, ideally with conditional requests. Source: best-practices doc.

---

## 4. Limits

Source: [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), unless noted.

- **Primary:** 5,000 requests/hour for a user token (PAT or OAuth). GitHub App installations get at least 5,000 and at most 12,500 off Enterprise Cloud. 304s are free (section 3).
- **Secondary:**
  - at most 100 concurrent requests;
  - at most **900 points/minute**: GET/HEAD/OPTIONS cost 1, **POST/PATCH/PUT/DELETE cost 5**;
  - at most 90 s of CPU time per 60 s;
  - **at most 80 content-generating requests per minute and 500 per hour.**
- Going over a limit returns 403 or 429. Wait for `retry-after` or `x-ratelimit-reset`, at least one minute for secondary limits, then back off exponentially. GitHub warns that ignoring these "may result in the banning of your integration".
- Best-practice advice: send mutating requests **serially**, with **at least 1 s** between them (best-practices doc).
- **Commit-per-save:** with a commit on every keystroke-level save, 500 content-generating requests per hour (about one every 7 s on average) is the binding limit. The docs do not say which Git Data POSTs (blob, tree, commit, ref) count as "content-generating". If each one counts, a Git Data save uses several units, against one for a Contents API save. Batching or debouncing edits into fewer commits avoids the issue.
- **File size:** Contents GET returns content in full up to **1 MB**. From 1 to 100 MB only raw or object media types work. Over 100 MB is not supported. Get-blob supports up to **100 MB**. Sources: [Repository contents](https://docs.github.com/en/rest/repos/contents), [Blobs](https://docs.github.com/en/rest/git/blobs). Text notes are far below these limits.

---

## 5. CORS

- `api.github.com` sends `Access-Control-Allow-Origin: *`. Preflight allows GET, POST, PATCH, PUT, DELETE. Exposed headers include `ETag`, `Link`, `Location`, `Retry-After` and the `X-RateLimit-*` headers. Source: [Using CORS and JSONP](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests). Confirmed by live probe on 2026-10-01.
- So **every REST endpoint this app needs** can be called from the browser with a bearer token: contents, git refs, trees, blobs, commits and compare.
- **Not CORS-enabled:** the OAuth and device-flow endpoints on `github.com` (`/login/oauth/access_token`, `/login/device/code`). Sources: [Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [roadmap#1153](https://github.com/github/roadmap/issues/1153), live probe.
- Not checked in depth: `raw.githubusercontent.com` for private files. With the API returning raw content via `Accept: application/vnd.github.raw+json`, it is not needed.

---

## 6. Hosting the PWA

A PWA needs HTTPS (for the service worker). All the options below provide it.

- **GitHub Pages:**
  - On **GitHub Free**, Pages is available for **public repos only**. **GitHub Pro** adds Pages for private repos. Source: [GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans).
  - Even when built from a private repo, the published **site is public on the internet**. Access-controlled ("private") Pages needs an **organization on GitHub Enterprise Cloud**. Sources: plans doc, [Changing the visibility of your Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site).
  - Limits: site at most 1 GB, soft 100 GB/month bandwidth, soft 10 builds/hour (not applied to custom Actions workflows), 10-minute deploy timeout. Not for commercial or SaaS use, and the site may not be used to collect passwords or credit cards. Source: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- **Cloudflare Pages (free):** 500 builds/month, 20,000 files, 25 MiB per asset, 100 custom domains. Source: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/). Cloudflare Workers could also host a small OAuth token-exchange proxy, if one were ever wanted.
- **Netlify (free):** a credit-based Free plan (300 credits) with custom domains and SSL. It can deploy from Git. Source: [Netlify pricing](https://www.netlify.com/pricing/). Netlify Functions could serve as a token proxy too.
- **Does public hosting expose the data?** The app's code (HTML/JS) is a static bundle with **no secrets**: the token is entered by the user and stored only on the device, and the data is fetched at runtime from the private repo with that token. Anyone can download the app code, but without the token they cannot read `PersonalNotes`. What is exposed is the code and the repo name or owner, if hard-coded. The main risk with a public origin is **XSS or a supply-chain compromise** of the app code. Either would run on the origin that holds the token. A narrowly scoped fine-grained PAT limits the damage. If an OAuth proxy were added, its client secret must live in the proxy, never in the bundle.
- The app code repo and the data repo can be separate. A public app repo on GitHub Free with Pages, plus the private `PersonalNotes` repo for data, is permitted by the plan terms above.

---

## Implications for the decisions

Facts that later tickets depend on, stated without choosing.

**Storage layout (04)**
- With the Contents API, each file is its own compare-and-swap unit (409 on a stale `sha`), and each save is one commit. Small, per-Item or per-Project files mean fewer cross-device conflicts. One large file means every concurrent edit conflicts.
- Changes that must touch several files at once (an item plus an index or Workspace list) are only atomic through the Git Data API.
- Contents API directory listings stop at 1,000 entries, and recursive tree reads stop at 100,000 entries / 7 MB. Contents GET is simplest up to 1 MB per file.
- The repo must not be empty before Git Data API calls. The first write has to be a Contents API write.

**Sync and conflict policy (05)**
- Cheap remote-change detection: poll the branch ref SHA with `If-None-Match` (a 304 is free). There are no webhooks without a server.
- Contents API concurrency is per file (409). Git Data API ref updates are fast-forward only by default, so any remote change rejects the push and forces a re-read and merge.
- Write budget: at most 80 content-generating requests per minute and 500 per hour, serial writes with at least 1 s between them, and 5 points per write. Commit-per-keystroke is not viable. Debouncing or batching into fewer commits fits the limits. The offline queue must push serially and honour `retry-after`.
- The Contents API's own docs say parallel create/update/delete calls conflict. Writes must be serial.

**Tech stack and hosting (08)**
- Only a fine-grained PAT works in a pure static PWA today. OAuth web or device flow needs a token-exchange proxy (serverless function), because `github.com` OAuth endpoints have no CORS and the web flow needs a client secret. GitHub's SPA/PKCE-without-secret mode is a paused roadmap item.
- PAT: scoped to `PersonalNotes`, Contents R/W, user-chosen expiry (no expiry allowed for a personal account). It is entered once per device, and secure storage is an open question.
- OAuth or GitHub App tokens expire after 8 h, with refresh tokens lasting 6 months, so the proxy is needed on every refresh, not only at login.
- Hosting: GitHub Pages is free only from a public repo, Pro allows a private source, and the site is public either way unless the user has Enterprise Cloud. Cloudflare Pages and Netlify are free HTTPS alternatives. A public app bundle exposes no data if it holds no secrets. The real risk is XSS or the supply chain on the token-holding origin.
