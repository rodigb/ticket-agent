import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSkill, type Skill } from '../src/agent/skills';

export function loadSkillsNode(dir = 'skills'): Skill[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'SKILL.md')))
    .map((d) => {
      const s = parseSkill(readFileSync(join(dir, d.name, 'SKILL.md'), 'utf8'));
      if (s.name !== d.name) throw new Error(`Skill name "${s.name}" must match its folder "${d.name}"`);
      return s;
    });
}