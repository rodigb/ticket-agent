// Parse SKILL.md files and format them for a prompt. Pure functions: callers decide how to
// load the raw text (fs in Node, Vite's import.meta.glob in the browser).

export interface Skill {
  name: string;
  description: string;
  body: string;
}

export function parseSkill(raw: string): Skill {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('SKILL.md must start with a --- frontmatter block');
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!meta.name || !meta.description) throw new Error('SKILL.md frontmatter needs name and description');
  return { name: meta.name, description: meta.description, body: m[2].trim() };
}

// Appended to a system prompt. Changing a prompt means bumping PROMPT_VERSION.
export const formatSkills = (skills: Skill[]): string =>
  skills.length ? `\n\nFollow these guidelines:\n\n${skills.map((s) => `## ${s.name}\n${s.body}`).join('\n\n')}` : '';

export function pickSkills(all: Skill[], names: string[]): Skill[] {
  return names.map((n) => {
    const s = all.find((x) => x.name === n);
    if (!s) throw new Error(`Skill not found: ${n}`);
    return s;
  });
}