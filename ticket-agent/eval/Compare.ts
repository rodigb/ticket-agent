/* Run: npx tsx eval/compare.ts [--md]
 * Reads every file in eval/results/ and prints one comparable row per run.
 * Recall/precision are recomputed from the saved ticket files, so old results can be rescored. */
import { readdirSync, readFileSync } from 'node:fs';

interface Case { id: string; expectedFiles: string[]; vague?: boolean }
interface CaseRow { id: string; valid: boolean; attempts: number; ms: number; files: string[]; hallucinatedFiles: number | null }
interface Run {
  runAt: string; model: string; promptVersion: string; skills?: string[]; skillsHash?: string;
  repoHash?: string; repoFiles?: number; cases: CaseRow[];
}

const cases: Case[] = JSON.parse(readFileSync('eval/cases.json', 'utf8'));
const byId = new Map(cases.map((c) => [c.id, c]));
const norm = (f: string) => f.replace(/^\.?\//, '');
const match = (f: string, want: string) => norm(f) === want || want.endsWith('/' + norm(f));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => (Number.isNaN(x) ? 'n/a' : `${Math.round(x * 100)}%`);

const runs: Run[] = readdirSync('eval/results')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`eval/results/${f}`, 'utf8')) as Run)
  .sort((a, b) => a.runAt.localeCompare(b.runAt));

if (!runs.length) { console.log('No results in eval/results/. Run the eval first.'); process.exit(0); }

const rows = runs.map((r) => {
  const scored = r.cases.filter((c) => !byId.get(c.id)?.vague);
  const exp = (c: CaseRow) => byId.get(c.id)?.expectedFiles ?? [];
  const recall = (c: CaseRow) => exp(c).filter((w) => c.files.some((f) => match(f, w))).length / (exp(c).length || 1);
  const valid = scored.filter((c) => c.valid);
  const withFiles = valid.filter((c) => c.files.length);
  const invented = r.cases.map((c) => c.hallucinatedFiles).filter((x): x is number => x !== null);
  return {
    run: `${r.runAt.slice(5, 16).replace('T', ' ')}`,
    model: r.model,
    prompt: r.promptVersion,
    skills: r.skills?.length ? `${r.skills.join('+')}@${r.skillsHash ?? '?'}` : r.skills ? 'none' : '?',
    repo: r.repoHash ?? 'unknown',
    'valid': pct(r.cases.filter((c) => c.valid).length / r.cases.length),
    '1st try': pct(r.cases.filter((c) => c.valid && c.attempts === 1).length / r.cases.length),
    'recall (valid only)': pct(mean(valid.map(recall))),
    'recall (end-to-end)': pct(mean(scored.map((c) => (c.valid ? recall(c) : 0)))),
    'precision': pct(mean(withFiles.map((c) => c.files.filter((f) => exp(c).some((w) => match(f, w))).length / c.files.length))),
    'files/ticket': mean(valid.map((c) => c.files.length)).toFixed(1),
    'invented': pct(mean(invented)),
    'sec': (mean(r.cases.map((c) => c.ms)) / 1000).toFixed(1),
  };
});

if (process.argv.includes('--md')) {
  const keys = Object.keys(rows[0]);
  console.log(`| ${keys.join(' | ')} |\n|${keys.map(() => '---').join('|')}|`);
  for (const r of rows) console.log(`| ${Object.values(r).join(' | ')} |`);
} else {
  console.table(rows);
}

const hashes = new Set(rows.map((r) => r.repo));
if (hashes.size > 1) console.log(`\nWARNING: runs used ${hashes.size} different repo states (${[...hashes].join(', ')}). Only compare rows with the same repo hash.`);
console.log('\nPrecision is measured against eval/cases.json, which is a judgement call: a ticket can name a sensible file the labels omit.');