export interface RepoRef {
  owner: string;
  name: string;
  slug: string; // "owner/name", the form the rest of the app uses
}

const PART = /^[A-Za-z0-9_.-]+$/;

// GitHub paths that look like owner/repo but are site pages.
const RESERVED_OWNERS = new Set([
  'orgs', 'settings', 'topics', 'marketplace', 'sponsors', 'features', 'about', 'pricing', 'login', 'explore', 'search',
]);

// Accepts "owner/repo", "github.com/owner/repo", full https URLs (including /tree/..., /blob/..., trailing
// slash, query or hash), "owner/repo.git" and "git@github.com:owner/repo.git". Returns null for anything else.
export function parseRepoInput(input: string): RepoRef | null {
  let s = input.trim();
  if (!s) return null;

  s = s
    .replace(/^git@github\.com:/i, 'github.com/')
    .replace(/^ssh:\/\/git@/i, '')
    .replace(/^https?:\/\//i, '')
    .split(/[?#]/)[0];

  const segments = s.split('/').filter(Boolean);

  // A first segment containing a dot is a host. GitHub owner names cannot contain dots.
  if (segments[0]?.includes('.')) {
    const host = segments.shift()!.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') return null;
  }

  const owner = segments[0];
  const name = segments[1]?.replace(/\.git$/i, '');
  if (!owner || !name) return null;
  if (!PART.test(owner) || !PART.test(name) || name === '.' || name === '..') return null;
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return null;

  return { owner, name, slug: `${owner}/${name}` };
}