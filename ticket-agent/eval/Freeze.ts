/* Run: npx tsx eval/freeze.ts <name>   e.g. npx tsx eval/freeze.ts v3-base
 * Copies the project's source into eval/fixtures/<name>/ so evals index a frozen repo. */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const name = process.argv[2];
if (!name || !/^[\w.-]+$/.test(name)) throw new Error('Usage: npx tsx eval/freeze.ts <name>');
const dest = join('eval', 'fixtures', name);
if (existsSync(dest)) throw new Error(`${dest} already exists. Snapshots are immutable; pick a new name.`);
mkdirSync(dest, { recursive: true });
for (const item of ['src', 'skills', 'AGENTS.md', 'package.json']) {
  if (existsSync(item)) cpSync(item, join(dest, item), { recursive: true });
}
console.log(`Froze the project into ${dest}. Run: npm run eval -- --provider ollama --model <m> --snapshot ${name}`);