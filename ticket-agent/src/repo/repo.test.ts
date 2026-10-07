import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { parseRepoInput } from '../repo/parseRepo';
import { describeGitHubError, indexRepo } from '../repo/repo';

describe('parseRepoInput', () => {
  const ok: [string, string][] = [
    ['owner/repo', 'owner/repo'],
    ['  owner/repo  ', 'owner/repo'],
    ['https://github.com/owner/repo', 'owner/repo'],
    ['https://github.com/owner/repo/', 'owner/repo'],
    ['http://www.github.com/owner/repo', 'owner/repo'],
    ['github.com/owner/repo', 'owner/repo'],
    ['https://github.com/owner/repo.git', 'owner/repo'],
    ['git@github.com:owner/repo.git', 'owner/repo'],
    ['https://github.com/owner/repo/tree/main/src', 'owner/repo'],
    ['https://github.com/owner/repo/blob/main/README.md#L10', 'owner/repo'],
    ['https://github.com/owner/repo?tab=readme-ov-file', 'owner/repo'],
    ['https://github.com/my-org/my.repo-name_2', 'my-org/my.repo-name_2'],
  ];
  for (const [input, slug] of ok) it(`accepts ${input}`, () => assert.equal(parseRepoInput(input)?.slug, slug));

  const bad = ['', '   ', 'owner', 'https://github.com/owner', 'https://gitlab.com/owner/repo',
    'https://github.com/orgs/acme/repositories', 'owner/re po', 'https://example.com/a/b', '../..'];
  for (const input of bad) it(`rejects "${input}"`, () => assert.equal(parseRepoInput(input), null));
});

describe('describeGitHubError', () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  it('404 mentions private repos and tokens', () => assert.match(describeGitHubError(404, h({})), /not found.*token/i));
  it('401 mentions the token', () => assert.match(describeGitHubError(401, h({})), /token/i));
  it('403 with no quota left is a rate limit', () =>
    assert.match(describeGitHubError(403, h({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' })), /rate limit/i));
  it('plain 403 is not called a rate limit', () => assert.doesNotMatch(describeGitHubError(403, h({ 'x-ratelimit-remaining': '12' })), /rate limit/i));
});

describe('indexRepo with a mocked GitHub', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  const treeEntries = [
    { path: 'README.md', type: 'blob', size: 20 },
    { path: 'src/a b.ts', type: 'blob', size: 30 },
    { path: 'node_modules/x.js', type: 'blob', size: 10 },
    { path: 'logo.png', type: 'blob', size: 10 },
    { path: 'big.ts', type: 'blob', size: 50000 },
    { path: 'src', type: 'tree' },
  ];

  function mock() {
    const calls: { url: string; auth: string | undefined }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      calls.push({ url, auth });
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url === 'https://api.github.com/repos/o/r') return json({ default_branch: 'main', description: 'demo' });
      if (url.startsWith('https://api.github.com/repos/o/r/git/trees/main')) return json({ tree: treeEntries, truncated: false });
      if (url.startsWith('https://raw.githubusercontent.com/o/r/main/') || url.includes('/contents/')) return new Response('line1\nline2', { status: 200 });
      return new Response('nope', { status: 404 });
    }) as typeof fetch;
    return calls;
  }

  it('without a token reads files from the raw host, using only 2 API calls', async () => {
    const calls = mock();
    const m = await indexRepo('o/r', '');
    const api = calls.filter((c) => c.url.startsWith('https://api.github.com'));
    const raw = calls.filter((c) => c.url.startsWith('https://raw.githubusercontent.com'));
    assert.equal(api.length, 2);
    assert.equal(raw.length, 2); // README.md and src/a b.ts only
    assert.ok(raw.some((c) => c.url.endsWith('/src/a%20b.ts')), 'path segments are URL-encoded');
    assert.ok(calls.every((c) => c.auth === undefined));
    assert.deepEqual(m.paths.sort(), ['README.md', 'src/a b.ts']);
    assert.equal(m.repo, 'o/r');
  });

  it('with a token reads files through the API and sends the token', async () => {
    const calls = mock();
    await indexRepo('o/r', 'secret');
    assert.equal(calls.filter((c) => c.url.startsWith('https://raw.githubusercontent.com')).length, 0);
    assert.equal(calls.filter((c) => c.url.includes('/contents/')).length, 2);
    assert.ok(calls.every((c) => c.auth === 'Bearer secret'));
  });

  it('reports a missing repository clearly', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 404 })) as typeof fetch;
    await assert.rejects(indexRepo('o/missing', ''), /not found/i);
  });
});