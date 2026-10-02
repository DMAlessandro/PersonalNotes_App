// GitHub REST via plain fetch (spec §7). Only the calls Pull and Push need (spec §6), sent one at a time.
// Research: .scratch/personal-note-app/research/github-backend.md

export type TreeEntry = { path: string; sha: string };

/** What the sync engine needs from a repo. The real one talks to api.github.com; tests use an in-memory fake. */
export interface Git {
  /**
   * The branch head, or 'empty' for a repo with no commits. `cached` = GitHub answered 304 (free) and
   * `sha` is the head seen with that ETag: still the real head, whatever base the caller is on.
   */
  getHead(): Promise<{ status: 'ok'; sha: string; cached?: boolean } | { status: 'empty' }>;
  getCommitTree(commitSha: string): Promise<string>;
  /** Every file (blob) in the tree, recursively. */
  getTree(treeSha: string): Promise<TreeEntry[]>;
  getBlob(sha: string): Promise<string>;
  /** New tree on top of `baseTree`: content to write, null to delete. */
  createTree(baseTree: string, changes: Record<string, string | null>): Promise<string>;
  createCommit(message: string, tree: string, parent: string): Promise<string>;
  /** Fast-forward only: 'rejected' when the branch moved (the other device pushed). */
  updateRef(sha: string): Promise<'ok' | 'rejected'>;
  /** First write to an empty repo (the Git Data API refuses empty repos). */
  initFile(path: string, content: string, message: string): Promise<{ commit: string; tree: string }>;
}

export type GitHubErrorKind = 'auth' | 'forbidden' | 'rate' | 'notfound' | 'offline' | 'other';

export class GitHubError extends Error {
  constructor(
    readonly kind: GitHubErrorKind,
    message: string,
    readonly status = 0,
    readonly retryAfter: number | null = null,
  ) {
    super(message);
  }
}

export type RepoConfig = { owner: string; repo: string; branch: string; token: string };

const API = 'https://api.github.com';

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export class GitHubClient implements Git {
  /** ETag of the last branch-head answer, and the head it described. */
  private etag: { tag: string; sha: string } | null = null;

  constructor(
    private readonly cfg: RepoConfig,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private url(path: string) {
    const { owner, repo } = this.cfg;
    return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${path}`;
  }

  private async call(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchFn(this.url(path), {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: accept,
          Authorization: `Bearer ${this.cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new GitHubError('offline', 'No connection to GitHub.');
    }
    if (res.status === 401) throw new GitHubError('auth', 'The token was refused: it may have expired or been revoked.', 401);
    if (res.status === 403 || res.status === 429) {
      const ra = res.headers.get('retry-after');
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (res.status === 429 || ra || remaining === '0') {
        throw new GitHubError('rate', 'GitHub asked the app to slow down. Try again in a minute.', res.status, ra ? Number(ra) : null);
      }
      throw new GitHubError('forbidden', 'The token cannot do this. Check it has Contents: Read and write on this repo.', 403);
    }
    return res;
  }

  private async json<T>(res: Response, what: string): Promise<T> {
    if (!res.ok) {
      if (res.status === 404) throw new GitHubError('notfound', `${what}: not found. Check the owner, repo and branch.`, 404);
      throw new GitHubError('other', `${what} failed (${res.status}).`, res.status);
    }
    return (await res.json()) as T;
  }

  /** Settings → Test connection: the repo exists and the token may write to it. */
  async checkAccess(): Promise<{ canPush: boolean; private: boolean }> {
    const r = await this.json<{ permissions?: { push?: boolean }; private: boolean }>(await this.call(''), 'The repo');
    return { canPush: !!r.permissions?.push, private: r.private };
  }

  async getHead() {
    const res = await this.call(`/git/ref/heads/${encodeURIComponent(this.cfg.branch)}`, {
      headers: this.etag ? { 'If-None-Match': this.etag.tag } : {},
    });
    if (res.status === 304 && this.etag) return { status: 'ok' as const, sha: this.etag.sha, cached: true };
    if (res.status === 409) return { status: 'empty' as const }; // "Git Repository is empty."
    if (res.status === 404) {
      // An empty repo has no branch either; tell the two apart.
      const repo = await this.json<{ size: number }>(await this.call(''), 'The repo');
      if (repo.size === 0) return { status: 'empty' as const };
    }
    const r = await this.json<{ object: { sha: string } }>(res, `Branch ${this.cfg.branch}`);
    const tag = res.headers.get('etag');
    this.etag = tag ? { tag, sha: r.object.sha } : null;
    return { status: 'ok' as const, sha: r.object.sha };
  }

  /** Forget the ETag so the next getHead() really asks (after our own Push moved the branch). */
  resetEtag() {
    this.etag = null;
  }

  async getCommitTree(commitSha: string) {
    const r = await this.json<{ tree: { sha: string } }>(await this.call(`/git/commits/${commitSha}`), 'Reading a commit');
    return r.tree.sha;
  }

  async getTree(treeSha: string) {
    const r = await this.json<{ tree: { path: string; type: string; sha: string }[]; truncated: boolean }>(
      await this.call(`/git/trees/${treeSha}?recursive=1`),
      'Reading the file list',
    );
    if (r.truncated) throw new GitHubError('other', 'The repo has too many files to read in one go.');
    return r.tree.filter((e) => e.type === 'blob').map((e) => ({ path: e.path, sha: e.sha }));
  }

  async getBlob(sha: string) {
    const res = await this.call(`/git/blobs/${sha}`, {}, 'application/vnd.github.raw+json');
    if (!res.ok) await this.json(res, 'Reading a file');
    return new TextDecoder().decode(await res.arrayBuffer());
  }

  async createTree(baseTree: string, changes: Record<string, string | null>) {
    const tree = Object.entries(changes).map(([path, content]) =>
      content === null
        ? { path, mode: '100644', type: 'blob', sha: null }
        : { path, mode: '100644', type: 'blob', content },
    );
    const r = await this.json<{ sha: string }>(
      await this.call('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) }),
      'Writing files',
    );
    return r.sha;
  }

  async createCommit(message: string, tree: string, parent: string) {
    const r = await this.json<{ sha: string }>(
      await this.call('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree, parents: [parent] }) }),
      'Making the commit',
    );
    return r.sha;
  }

  async updateRef(sha: string) {
    const res = await this.call(`/git/refs/heads/${encodeURIComponent(this.cfg.branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha, force: false }),
    });
    if (res.status === 409 || res.status === 422) return 'rejected' as const;
    await this.json(res, 'Moving the branch');
    this.etag = null;
    return 'ok' as const;
  }

  async initFile(path: string, content: string, message: string) {
    const r = await this.json<{ commit: { sha: string; tree: { sha: string } } }>(
      await this.call(`/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        body: JSON.stringify({ message, content: utf8ToBase64(content) }),
      }),
      'Setting up the repo',
    );
    this.etag = null;
    return { commit: r.commit.sha, tree: r.commit.tree.sha };
  }
}

/** Git's blob id for a text file: SHA-1 of "blob <bytes>\0<content>". Lets the app tell which files changed without downloading them. */
export async function gitBlobSha(text: string): Promise<string> {
  const body = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head);
  all.set(body, head.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}
