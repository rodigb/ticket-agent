import { useState } from "react";
import { parseRepoInput } from "./parseRepo";

const KEY = "repo-placeholders";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

// Placeholders only remember a repo's slug; indexed repo memory is stored separately and is never touched here.
export function useRepoPlaceholders() {
  const [slugs, setSlugs] = useState<string[]>(load);

  const persist = (next: string[]) => {
    setSlugs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: placeholders last for this session only */
    }
  };

  // Returns an error message, or null when the placeholder was added.
  const add = (input: string): string | null => {
    const ref = parseRepoInput(input);
    if (!ref) {
      return "Enter a GitHub URL such as https://github.com/owner/repo, or owner/repo.";
    }
    if (slugs.includes(ref.slug)) return `${ref.slug} is already added.`;
    persist([...slugs, ref.slug]);
    return null;
  };

  const remove = (slug: string) => persist(slugs.filter((s) => s !== slug));

  return { slugs, add, remove };
}
