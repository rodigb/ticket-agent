import type { Chunk, RepoMemory } from '../types';

const GH = 'https://api.github.com';
export const SKIP = /(^|\/)(node_modules|dist|build|\.git|vendor)\/|\.(png|jpe?g|gif|svg|ico|lock|woff2?|pdf|zip|map)$|\.min\./i;
export const KEY = /(^|\/)(README\.md|package\.json|pyproject\.toml|requirements\.txt|go\.mod|pom\.xml|Dockerfile|CONTRIBUTING\.md)$/i;
const MEM_KEY = (repo: string) => `ticket-agent:memory:${repo}`;

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

export async function indexRepo(
  repo: string,
  token: string,
  onProgress?: (current: number, total: number) => void,
): Promise<RepoMemory> {
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const get = async (url: string, extra: Record<string, string> = {}): Promise<Response> => {
    const r = await fetch(url, { headers: { ...auth, ...extra } });
    if (!r.ok) throw new Error(`GitHub ${r.status} for ${url}`);
    return r;
  };

  const meta: GitHubRepoMeta = await (await get(`${GH}/repos/${repo}`)).json();
  const tree: GitHubTree = await (
    await get(`${GH}/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`)
  ).json();

  const files = tree.tree.filter(
    (f) => f.type === 'blob' && !SKIP.test(f.path) && (f.size ?? 0) < 20000,
  );
  const chosen = [
    ...files.filter((f) => KEY.test(f.path)),
    ...files.filter((f) => !KEY.test(f.path)),
  ].slice(0, 120);

  const chunks: Chunk[] = [];
  for (let i = 0; i < chosen.length; i++) {
    onProgress?.(i + 1, chosen.length);
    const text = await (
      await get(`${GH}/repos/${repo}/contents/${chosen[i].path}`, { Accept: 'application/vnd.github.raw' })
    ).text();
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