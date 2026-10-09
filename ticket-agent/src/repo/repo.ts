import type { Chunk, RepoMemory } from '../types';

const GH = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
export const SKIP = /(^|\/)(node_modules|dist|build|\.git|vendor)\/|\.(png|jpe?g|gif|svg|ico|lock|woff2?|pdf|zip|map)$|\.min\./i;
export const KEY = /(^|\/)(README\.md|package\.json|pyproject\.toml|requirements\.txt|go\.mod|pom\.xml|Dockerfile|CONTRIBUTING\.md)$/i;
const MEM_KEY = (repo: string) => `ticket-agent:memory:${repo.toLowerCase()}`;
// The indexer reads at most this many files, skipping any at or above this size.
export const MAX_INDEXED_FILES = 120;
export const MAX_FILE_BYTES = 20000;

// Only the GitHub API fields we actually use
interface GitHubRepoMeta { default_branch: string; description: string | null }
interface GitHubTreeEntry { path: string; type: 'blob' | 'tree' | 'commit'; size?: number }
interface GitHubTree { tree: GitHubTreeEntry[]; truncated: boolean }

export function chunkFile(path: string, text: string): Chunk[] {
  const lines = text.split('\n');
  const out: Chunk[] = [];
  for (let s = 0; s < lines.length; s += 40) out.push({ path, text: lines.slice(s, s + 40).join('\n') });
  return out;
}

// Turns a failed GitHub response into something the user can act on.
export function describeGitHubError(status: number, headers: { get(name: string): string | null }): string {
  if (status === 404) return 'Repository not found. Check the URL, or add a GitHub token if it is private.';
  if (status === 401) return 'GitHub rejected the token. Check it and try again.';
  if ((status === 403 || status === 429) && headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(headers.get('x-ratelimit-reset'));
    const when = reset
      ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, or add a GitHub token.`
      : ' Add a GitHub token or try again later.';
    return `GitHub rate limit reached.${when}`;
  }
  if (status === 403) return 'GitHub refused the request. A token with access to this repository may be needed.';
  return `GitHub returned an error (${status}).`;
}

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

// GitHub reports repo size in KB. Thresholds are a rough guide to how much of a repo the in-browser indexer can cover.
export type RepoSizeLevel = 'small' | 'medium' | 'large';
export const MEDIUM_REPO_KB = 10 * 1024;
export const LARGE_REPO_KB = 100 * 1024;

export function classifyRepoSize(kb: number): RepoSizeLevel {
  if (kb >= LARGE_REPO_KB) return 'large';
  if (kb >= MEDIUM_REPO_KB) return 'medium';
  return 'small';
}

export function formatRepoSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

export async function fetchRepoSize(repo: string, token: string, signal?: AbortSignal): Promise<number> {
  const r = await fetch(`${GH}/repos/${repo}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
  if (!r.ok) throw new Error(describeGitHubError(r.status, r.headers));
  const meta: { size: number } = await r.json();
  return meta.size;
}

export interface RepoInfo {
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  sizeKb: number;
  defaultBranch: string;
  pushedAt: string;
}

export async function fetchRepoInfo(repo: string, signal?: AbortSignal, token = ''): Promise<RepoInfo> {
  const r = await fetch(`${GH}/repos/${repo}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
  if (!r.ok) throw new Error(describeGitHubError(r.status, r.headers));
  const m: {
    full_name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    size: number;
    default_branch: string;
    pushed_at: string;
  } = await r.json();
  return {
    fullName: m.full_name,
    description: m.description,
    language: m.language,
    stars: m.stargazers_count,
    sizeKb: m.size,
    defaultBranch: m.default_branch,
    pushedAt: m.pushed_at,
  };
}

export interface RepoDigest {
  readableFiles: number; // files the indexer is allowed to read
  indexedFiles: number; // how many of those it will actually read
  truncated: boolean; // GitHub cut the file list short because the repo is huge
}

export async function fetchRepoDigest(
  repo: string,
  branch: string,
  signal?: AbortSignal,
  token = '',
): Promise<RepoDigest> {
  const r = await fetch(`${GH}/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!r.ok) throw new Error(describeGitHubError(r.status, r.headers));
  const tree: GitHubTree = await r.json();
  const readableFiles = tree.tree.filter(
    (f) => f.type === 'blob' && !SKIP.test(f.path) && (f.size ?? 0) < MAX_FILE_BYTES,
  ).length;
  return { readableFiles, indexedFiles: Math.min(readableFiles, MAX_INDEXED_FILES), truncated: tree.truncated };
}

export type DigestLevel = 'easy' | 'moderate' | 'hard';

// How much of the repo's readable code the agent will see: the more it covers, the better grounded the tickets.
export function rateDigestibility(d: RepoDigest): DigestLevel {
  if (d.truncated || d.readableFiles === 0) return 'hard';
  const coverage = d.indexedFiles / d.readableFiles;
  if (coverage >= 0.75) return 'easy';
  if (coverage >= 0.35) return 'moderate';
  return 'hard';
}

export async function indexRepo(
  repo: string,
  token: string,
  onProgress?: (current: number, total: number) => void,
): Promise<RepoMemory> {
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const get = async (url: string, extra: Record<string, string> = {}): Promise<Response> => {
    const r = await fetch(url, { headers: { ...auth, ...extra } });
    if (!r.ok) throw new Error(describeGitHubError(r.status, r.headers));
    return r;
  };

  // With a token, read through the API (5,000 requests an hour). Without one, the API allows only 60 an hour,
  // so file contents come from raw.githubusercontent.com, which is not part of that quota.
  const readFile = async (path: string, branch: string): Promise<string> => {
    if (token) {
      return (await get(`${GH}/repos/${repo}/contents/${encodePath(path)}`, { Accept: 'application/vnd.github.raw' })).text();
    }
    const r = await fetch(`${RAW}/${repo}/${encodePath(branch)}/${encodePath(path)}`);
    if (!r.ok) throw new Error(`Could not read ${path} from GitHub (${r.status}).`);
    return r.text();
  };

  const meta: GitHubRepoMeta = await (await get(`${GH}/repos/${repo}`)).json();
  const tree: GitHubTree = await (
    await get(`${GH}/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`)
  ).json();

  const files = tree.tree.filter(
    (f) => f.type === 'blob' && !SKIP.test(f.path) && (f.size ?? 0) < MAX_FILE_BYTES,
  );
  const chosen = [
    ...files.filter((f) => KEY.test(f.path)),
    ...files.filter((f) => !KEY.test(f.path)),
  ].slice(0, MAX_INDEXED_FILES);

  const chunks: Chunk[] = [];
  for (let i = 0; i < chosen.length; i++) {
    onProgress?.(i + 1, chosen.length);
    const text = await readFile(chosen[i].path, meta.default_branch);
    chunks.push(...chunkFile(chosen[i].path, text));
  }

  return {
    repo,
    description: meta.description,
    paths: files.map((f) => f.path),
    chunks,
    profile: null,
    indexedAt: Date.now(),
  };
}

export const saveMemory = (m: RepoMemory): void => {
  try {
    localStorage.setItem(MEM_KEY(m.repo), JSON.stringify(m));
  } catch {
    /* quota exceeded: needs IndexedDB */
  }
};

export const loadMemory = (repo: string): RepoMemory | null => {
  try {
    const raw = localStorage.getItem(MEM_KEY(repo));
    return raw ? (JSON.parse(raw) as RepoMemory) : null;
  } catch {
    return null;
  }
};

// Keyword retrieval (TF-IDF style). Swap for embeddings (Ollama /api/embed) later without changing callers.
const tok = (s: string): string[] => s.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? [];

export function retrieve(memory: RepoMemory, query: string, k = 6): Chunk[] {
  const q = [...new Set(tok(query))];
  const docs = memory.chunks.map((c) => ({ c, t: tok(c.path + ' ' + c.text) }));
  const df: Record<string, number> = Object.fromEntries(
    q.map((w) => [w, docs.filter((d) => d.t.includes(w)).length]),
  );
  return docs
    .map(({ c, t }) => ({
      c,
      score: q.reduce(
        (s, w) => s + Math.log(1 + t.filter((x) => x === w).length) * Math.log(1 + docs.length / (1 + df[w])),
        0,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}