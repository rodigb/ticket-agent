import { parseSkill, type Skill } from './skills';

// Vite-only: import.meta.glob does not exist in Node. The eval uses eval/loadSkillsNode.ts instead.
const files = import.meta.glob('/skills/*/SKILL.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const loadSkillsBrowser = (): Skill[] => Object.values(files).map((raw) => parseSkill(raw));