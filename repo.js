const GH = 'https://api.github.com';
const SKIP = /(^|\/)(node_modules|dist|build|\.git|vendor)\/|\.(png|jpe?g|gif|svg|ico|lock|woff2?|pdf|zip|map)$|\.min\./i;
const KEY = /(^|\/)(README\.md|package\.json|pyproject\.toml|requirements\.txt|go\.mod|pom\.xml|Dockerfile|CONTRIBUTING\.md)$/i;
const MEM_KEY = (repo) => `ticket-agent:memory:${repo}`;

export async function indexRepo(repo, token, onProgress) {
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  const get = async (url, extra = {}) => {
    const r = await fetch(url, { headers: { ...h, ...extra } });
    if (!r.ok) throw new Error(`GitHub ${r.status} for ${url}`);
    return r;
  };
  const meta = await (await get(`${GH}/repos/${repo}`)).json();
  const tree = await (await get(`${GH}/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`)).json();
  const files = tree.tree.filter((f) => f.type === 'blob' && !SKIP.test(f.path) && f.size < 20000);
  const chosen = [...files.filter((f) => KEY.test(f.path)), ...files.filter((f) => !KEY.test(f.path))].slice(0, 120);

  const chunks = [];
  for (let i = 0; i < chosen.length; i++) {
    onProgress?.(i + 1, chosen.length);
    const text = await (await get(`${GH}/repos/${repo}/contents/${chosen[i].path}`, { Accept: 'application/vnd.github.raw' })).text();
    const lines = text.split('\n');
    for (let s = 0; s < lines.length; s += 40) {
      chunks.push({ path: chosen[i].path, text: lines.slice(s, s + 40).join('\n') });
    }
  }
  return { repo, description: meta.description, paths: files.map((f) => f.path), chunks, profile: null, indexedAt: Date.now() };
}

export const saveMemory = (m) => { try { localStorage.setItem(MEM_KEY(m.repo), JSON.stringify(m)); } catch { /* quota: needs IndexedDB */ } };
export const loadMemory = (repo) => { try { return JSON.parse(localStorage.getItem(MEM_KEY(repo))); } catch { return null; } };

// Keyword retrieval (TF-IDF style). Swap for embeddings (Ollama /api/embed) later without changing callers.
const tok = (s) => s.toLowerCase().match(/[a-z0-9_]{3,}/g) || [];
export function retrieve(memory, query, k = 6) {
  const q = [...new Set(tok(query))];
  const docs = memory.chunks.map((c) => ({ c, t: tok(c.path + ' ' + c.text) }));
  const df = Object.fromEntries(q.map((w) => [w, docs.filter((d) => d.t.includes(w)).length]));
  return docs
    .map(({ c, t }) => ({
      c,
      score: q.reduce((s, w) => s + Math.log(1 + t.filter((x) => x === w).length) * Math.log(1 + docs.length / (1 + df[w])), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}
