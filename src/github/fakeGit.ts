// In-memory stand-in for a GitHub repo, for tests: same contract as the real client (fast-forward-only
// branch, empty-repo rule, blob ids computed the way git does).
import { gitBlobSha, type Git } from './client';

export class FakeGit implements Git {
  head: string | null = null;
  commits: Record<string, { tree: string; parent: string | null; message: string }> = {};
  trees: Record<string, Record<string, string>> = {};
  blobs: Record<string, string> = {};
  calls: string[] = [];
  /** Runs just before updateRef: lets a test make "the other device" push in between. */
  beforeUpdateRef: (() => Promise<void>) | null = null;
  private n = 0;

  private id(prefix: string) {
    return `${prefix}${++this.n}`;
  }

  private async putBlob(content: string) {
    const sha = await gitBlobSha(content);
    this.blobs[sha] = content;
    return sha;
  }

  async getHead() {
    this.calls.push('getHead');
    return this.head ? { status: 'ok' as const, sha: this.head } : { status: 'empty' as const };
  }
  async getCommitTree(sha: string) {
    return this.commits[sha].tree;
  }
  async getTree(sha: string) {
    return Object.entries(this.trees[sha]).map(([path, s]) => ({ path, sha: s }));
  }
  async getBlob(sha: string) {
    this.calls.push(`getBlob`);
    return this.blobs[sha];
  }
  async createTree(baseTree: string, changes: Record<string, string | null>) {
    const files = { ...this.trees[baseTree] };
    for (const [p, c] of Object.entries(changes)) {
      if (c === null) delete files[p];
      else files[p] = await this.putBlob(c);
    }
    const sha = this.id('tree');
    this.trees[sha] = files;
    return sha;
  }
  async createCommit(message: string, tree: string, parent: string) {
    const sha = this.id('commit');
    this.commits[sha] = { tree, parent, message };
    return sha;
  }
  async updateRef(sha: string) {
    if (this.beforeUpdateRef) {
      const f = this.beforeUpdateRef;
      this.beforeUpdateRef = null;
      await f();
    }
    if (this.commits[sha].parent !== this.head) return 'rejected' as const;
    this.head = sha;
    this.calls.push('updateRef');
    return 'ok' as const;
  }
  async initFile(path: string, content: string, message: string) {
    if (this.head) throw new Error('not empty');
    const tree = this.id('tree');
    this.trees[tree] = { [path]: await this.putBlob(content) };
    const commit = this.id('commit');
    this.commits[commit] = { tree, parent: null, message };
    this.head = commit;
    return { commit, tree };
  }

  /** The files at the head of the branch. */
  files(): Record<string, string> {
    if (!this.head) return {};
    const t = this.trees[this.commits[this.head].tree];
    return Object.fromEntries(Object.entries(t).map(([p, s]) => [p, this.blobs[s]]));
  }

  /** Commit straight to the branch, as the other device would. */
  async commitFiles(changes: Record<string, string | null>, message = 'other device') {
    const tree = await this.createTree(this.commits[this.head!].tree, changes);
    const commit = await this.createCommit(message, tree, this.head!);
    this.head = commit;
    return commit;
  }
}
