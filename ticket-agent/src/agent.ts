import type { ZodType } from 'zod';
import { chat } from './providers';
import { retrieve } from './repo';
import { RepoProfileSchema, TicketSchema } from './schemas';
import type { LLMConfig, RepoMemory, RepoProfile, Ticket } from './types';

// Small models often wrap JSON in fences or prose, so take the outermost {...} block.
const extractJSON = (s: string): unknown => {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object found');
  return JSON.parse(s.slice(start, end + 1));
};

// Ask the model, validate against the schema, and on failure retry once with the error fed back.
async function askForJSON<T>(llm: LLMConfig, system: string, user: string, schema: ZodType<T>): Promise<T> {
  let prompt = user;
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat({ ...llm, system, user: prompt });
    try {
      const parsed = schema.safeParse(extractJSON(out));
      if (parsed.success) return parsed.data;
      problem = parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    }
    prompt = `${user}\n\nYour previous reply was invalid (${problem}). Reply again with corrected JSON only, no other text.`;
  }
  throw new Error(`The model returned invalid output twice (${problem}). Try a larger model.`);
}

// Run once after indexing: a compact "what kind of codebase is this" note kept in memory.
export async function buildProfile(memory: RepoMemory, llm: LLMConfig): Promise<RepoProfile> {
  const key = memory.chunks
    .filter((c) => /README|package\.json|pyproject|go\.mod|pom\.xml/i.test(c.path))
    .slice(0, 6);
  return askForJSON(
    llm,
    'You analyse codebases. Reply with JSON only: {"stack":[],"structure":"","conventions":[],"testing":"","notes":""}. All values are strings or arrays of strings. Be concrete and brief.',
    `Repo: ${memory.repo}\nDescription: ${memory.description}\nFiles (first 150):\n${memory.paths
      .slice(0, 150)
      .join('\n')}\n\nKey files:\n${key.map((c) => `--- ${c.path}\n${c.text}`).join('\n')}`,
    RepoProfileSchema,
  );
}

interface GenerateTicketArgs {
  requirement: string;
  memory: RepoMemory | null;
  llm: LLMConfig;
}

export async function generateTicket({ requirement, memory, llm }: GenerateTicketArgs): Promise<Ticket> {
  const context = memory ? retrieve(memory, requirement) : [];
  return askForJSON(
    llm,
    'You are a senior product engineer writing development tickets. Ground everything in the repo profile and code excerpts: reference real files/modules, follow existing conventions, never invent components that contradict them. Acceptance criteria must be testable, in Given/When/Then form. Reply with JSON only: {"type":"story|bug|task","title":"","description":"","acceptanceCriteria":["Given... When... Then..."],"tasks":[""],"affectedFiles":[""],"risks":[""],"openQuestions":[""],"estimate":"S|M|L"}',
    `Repo profile:\n${JSON.stringify(memory?.profile ?? 'none')}\n\nRelevant code:\n${
      context.map((c) => `--- ${c.path}\n${c.text}`).join('\n') || 'none'
    }\n\nRequirement:\n${requirement}`,
    TicketSchema,
  );
}

// ---- Exports for the ticket systems ----
interface JiraIssue {
  fields: { summary: string; issuetype: { name: 'Bug' | 'Task' | 'Story' }; description: string };
}
interface DevOpsPatchOp { op: 'add'; path: string; value: string }

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const toJira = (t: Ticket): JiraIssue => ({
  fields: {
    summary: t.title,
    issuetype: { name: t.type === 'bug' ? 'Bug' : t.type === 'task' ? 'Task' : 'Story' },
    description: `${t.description}\n\nAcceptance criteria:\n${t.acceptanceCriteria
      .map((a) => `* ${a}`)
      .join('\n')}\n\nTasks:\n${t.tasks.map((a) => `* ${a}`).join('\n')}`,
  },
});

// Azure DevOps text fields are HTML, so model output is escaped before it goes in.
export const toDevOps = (t: Ticket): DevOpsPatchOp[] => [
  { op: 'add', path: '/fields/System.Title', value: t.title },
  { op: 'add', path: '/fields/System.Description', value: escapeHtml(t.description).replace(/\n/g, '<br>') },
  {
    op: 'add',
    path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
    value: `<ul>${t.acceptanceCriteria.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`,
  },
];