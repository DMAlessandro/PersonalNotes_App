import { describe, expect, it } from 'vitest';
import { GitHubClient, GitHubError } from './client';

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

function fakeFetch(replies: Reply[]) {
  const seen: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    const r = replies.shift();
    if (!r) throw new TypeError('Failed to fetch');
    return new Response(r.status === 304 ? null : JSON.stringify(r.body ?? {}), { status: r.status, headers: r.headers });
  }) as unknown as typeof fetch;
  return { fn, seen };
}

const cfg = { owner: 'me', repo: 'PersonalNotes', branch: 'main', token: 'tok' };

describe('GitHubClient', () => {
  it('sends the token and asks for the branch head, then reuses the ETag (a 304 is free)', async () => {
    const { fn, seen } = fakeFetch([
      { status: 200, body: { object: { sha: 'abc' } }, headers: { etag: 'W/"1"' } },
      { status: 304 },
    ]);
    const c = new GitHubClient(cfg, fn);
    expect(await c.getHead()).toEqual({ status: 'ok', sha: 'abc' });
    expect(seen[0].url).toBe('https://api.github.com/repos/me/PersonalNotes/git/ref/heads/main');
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(await c.getHead()).toEqual({ status: 'ok', sha: 'abc', cached: true });
    expect((seen[1].init.headers as Record<string, string>)['If-None-Match']).toBe('W/"1"');
  });

  it('recognises an empty repo', async () => {
    const { fn } = fakeFetch([{ status: 409, body: { message: 'Git Repository is empty.' } }]);
    expect(await new GitHubClient(cfg, fn).getHead()).toEqual({ status: 'empty' });
  });

  it('reports a refused token, a rate limit, a missing repo and no connection as distinct errors', async () => {
    const kinds: string[] = [];
    for (const reply of <Reply[]>[
      { status: 401 },
      { status: 429, headers: { 'retry-after': '60' } },
      { status: 403, headers: { 'x-ratelimit-remaining': '0' } },
      { status: 403 },
      { status: 404 },
    ]) {
      const { fn } = fakeFetch([reply, { status: 200, body: { size: 5 } }]);
      try {
        await new GitHubClient(cfg, fn).getCommitTree('x');
      } catch (e) {
        kinds.push((e as GitHubError).kind);
      }
    }
    try {
      await new GitHubClient(cfg, fakeFetch([]).fn).getCommitTree('x');
    } catch (e) {
      kinds.push((e as GitHubError).kind);
    }
    expect(kinds).toEqual(['auth', 'rate', 'rate', 'forbidden', 'notfound', 'offline']);
  });

  it('treats a non-fast-forward ref update as "rejected", and never forces', async () => {
    const { fn, seen } = fakeFetch([{ status: 422, body: { message: 'Update is not a fast forward' } }]);
    expect(await new GitHubClient(cfg, fn).updateRef('c1')).toBe('rejected');
    expect(JSON.parse(seen[0].init.body as string)).toEqual({ sha: 'c1', force: false });
  });

  it('writes a tree with inline content and null for deletions', async () => {
    const { fn, seen } = fakeFetch([{ status: 201, body: { sha: 't2' } }]);
    await new GitHubClient(cfg, fn).createTree('t1', { 'a.json': '{}\n', 'old.md': null });
    expect(JSON.parse(seen[0].init.body as string)).toEqual({
      base_tree: 't1',
      tree: [
        { path: 'a.json', mode: '100644', type: 'blob', content: '{}\n' },
        { path: 'old.md', mode: '100644', type: 'blob', sha: null },
      ],
    });
  });

  it('sends the first file base64-encoded, keeping non-ASCII text intact', async () => {
    const { fn, seen } = fakeFetch([{ status: 201, body: { commit: { sha: 'c1', tree: { sha: 't1' } } } }]);
    await new GitHubClient(cfg, fn).initFile('data/index.json', 'città ✓\n', 'set up');
    const body = JSON.parse(seen[0].init.body as string);
    expect(new TextDecoder().decode(Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0)))).toBe('città ✓\n');
    expect(seen[0].url).toBe('https://api.github.com/repos/me/PersonalNotes/contents/data/index.json');
  });
});
