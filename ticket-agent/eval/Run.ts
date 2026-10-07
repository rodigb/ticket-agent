/* Run: npm run eval -- --provider ollama --model llama3.1
 *      ANTHROPIC_API_KEY=... npm run eval -- --provider anthropic --model claude-opus-5-5 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { PROMPT_VERSION } from '../src/agent/prompts';
import { buildProfile, generateTicket } from '../src/agent/ticketAgent';
import { createHash } from 'node:crypto';
import { pickSkills } from '../src/agent/skills';
import { loadSkillsNode } from './loadSkillsNode';
import { chunkFile, retrieve, SKIP } from '../src/repo/repo';
import type { LLMConfig, ProviderId, RepoMemory } from '../src/types';

interface Case { id: string; requirement: string; expectedFiles: string[]; vague?: boolean }
interface CaseResult {
  id: string; valid: boolean; attempts: number; ms: number;
  fileRecall: number | null; retrievalRecall: number | null; hallucinatedFiles: number | null;
  askedQuestions: boolean | null; files: string[]; newFiles?: string[]; error?: string; errorKind?: 'validation' | 'infra';
}

const ROOT = process.cwd();
// eval/ is excluded so the answer key can never leak into retrieval.
const EXCLUDE = /^(node_modules|dist|\.git|eval|public)(\/|$)|package-lock\.json$/;
const arg = (k: string): string | undefined => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p).split(sep).join('/');
    if (EXCLUDE.test(rel)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (!SKIP.test(rel) && statSync(p).size < 20000) out.push(rel);
  }
  return out;
}

function indexLocal(): RepoMemory {
  const paths = walk(ROOT);
  const chunks = paths.flatMap((p) => chunkFile(p, readFileSync(join(ROOT, p), 'utf8')));
  return { repo: 'local/ticket-agent', description: 'A ticket-writing agent', paths, chunks, profile: null, indexedAt: Date.now() };
}

const norm = (f: string) => f.replace(/^\.?\//, '');
// Map a path the model wrote onto a real repo path, so "repo/repo.ts" counts as "src/repo/repo.ts".
const resolve = (f: string, paths: string[]): string | null => {
  const n = norm(f);
  return paths.find((p) => p === n) ?? paths.find((p) => p.endsWith('/' + n)) ?? null;
};
const hit = (found: string[], want: string, paths: string[]) => found.some((f) => resolve(f, paths) === want);
const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(0)}%`);

async function main() {
  const provider = (arg('provider') ?? 'ollama') as ProviderId;
  const model = arg('model');
  if (!model) throw new Error('Pass --model, e.g. --model llama3.1');
  const llm: LLMConfig = { provider, model, apiKey: process.env.ANTHROPIC_API_KEY ?? '' };
  const skillNames = (arg('skills') ?? 'write-ticket').split(',').filter((n) => n && n !== 'none');
  const skills = pickSkills(loadSkillsNode(), skillNames);
  const skillsHash = createHash('sha1').update(skills.map((s) => s.name + s.body).join('\n')).digest('hex').slice(0, 8);
  const cases: Case[] = JSON.parse(readFileSync('eval/cases.json', 'utf8'));

  const memory = indexLocal();
  console.log(`Indexed ${memory.paths.length} files, ${memory.chunks.length} chunks. Profiling…`);
  memory.profile = await buildProfile(memory, llm);

  const results: CaseResult[] = [];
  for (const c of cases) {
    const t0 = Date.now();
    let attempts = 0;
    const retrieved = [...new Set(retrieve(memory, c.requirement).map((x) => x.path))];
    const retrievalRecall = c.vague ? null : c.expectedFiles.filter((f) => hit(retrieved, f, memory.paths)).length / c.expectedFiles.length;
    try {
      const t = await generateTicket({ requirement: c.requirement, memory, llm, skills, onAttempt: (n) => (attempts = n) });
      results.push({
        id: c.id, valid: true, attempts, ms: Date.now() - t0, retrievalRecall,
        fileRecall: c.vague ? null : c.expectedFiles.filter((f) => hit(t.affectedFiles, f, memory.paths)).length / c.expectedFiles.length,
        hallucinatedFiles: t.affectedFiles.length ? t.affectedFiles.filter((f) => resolve(f, memory.paths) === null).length / t.affectedFiles.length : null,
        askedQuestions: c.vague ? t.openQuestions.length > 0 : null,
        files: t.affectedFiles,
        newFiles: t.newFiles,
      });
    } catch (e) {
      results.push({ id: c.id, valid: false, attempts, ms: Date.now() - t0, fileRecall: null, retrievalRecall, hallucinatedFiles: null, askedQuestions: null, files: [], error: e instanceof Error ? e.message : String(e), errorKind: e instanceof Error && e.message.startsWith('The model returned invalid output') ? 'validation' : 'infra' });
    }
    console.log(`${c.id}: ${results.at(-1)!.valid ? 'ok' : 'INVALID'}`);
  }

  const summary = {
    infraErrors: results.filter((r) => r.errorKind === 'infra').length,
    validityRate: results.filter((r) => r.valid).length / results.length,
    firstPassRate: results.filter((r) => r.valid && r.attempts === 1).length / results.length,
    fileRecall: mean(results.map((r) => r.fileRecall)),
    retrievalRecall: mean(results.map((r) => r.retrievalRecall)),
    hallucinatedFileRate: mean(results.map((r) => r.hallucinatedFiles)),
    vagueAskedQuestions: results.find((r) => r.askedQuestions !== null)?.askedQuestions ?? null,
    avgSeconds: results.reduce((a, r) => a + r.ms, 0) / results.length / 1000,
  };
  console.table({
    'valid output': pct(summary.validityRate), 'infra errors': String(summary.infraErrors), 'valid first try': pct(summary.firstPassRate),
    'file recall (ticket)': pct(summary.fileRecall), 'file recall (retrieval alone)': pct(summary.retrievalRecall),
    'invented files': pct(summary.hallucinatedFileRate), 'vague req asks questions': String(summary.vagueAskedQuestions),
    'avg seconds': summary.avgSeconds.toFixed(1),
  });

  mkdirSync('eval/results', { recursive: true });
  const file = `eval/results/${new Date().toISOString().replace(/[:.]/g, '-')}_${model.replace(/[^\w.-]/g, '_')}.json`;
  writeFileSync(file, JSON.stringify({ runAt: new Date().toISOString(), provider, model, promptVersion: PROMPT_VERSION, skills: skillNames, skillsHash, repoFiles: memory.paths.length, repoHash: createHash('sha1').update(memory.chunks.map((c) => c.path + c.text).join('\n')).digest('hex').slice(0, 8), retrieval: 'keyword', summary, cases: results }, null, 2));
  console.log(`Saved ${file}`);
}
main().catch((e) => { console.error(e); process.exit(1); });