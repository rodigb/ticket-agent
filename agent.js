import { chat } from './providers.js';
import { retrieve } from './repo.js';

const parseJSON = (s) => JSON.parse(s.replace(/^```(?:json)?|```$/gm, '').trim());

// Run once after indexing: a compact "what kind of codebase is this" note kept in memory.
export async function buildProfile(memory, llm) {
  const key = memory.chunks.filter((c) => /README|package\.json|pyproject|go\.mod|pom\.xml/i.test(c.path)).slice(0, 6);
  const out = await chat({
    ...llm,
    system: 'You analyse codebases. Reply with JSON only: {"stack":[],"structure":"","conventions":[],"testing":"","notes":""}. Be concrete and brief.',
    user: `Repo: ${memory.repo}\nDescription: ${memory.description}\nFiles (first 150):\n${memory.paths.slice(0, 150).join('\n')}\n\nKey files:\n${key.map((c) => `--- ${c.path}\n${c.text}`).join('\n')}`,
  });
  return parseJSON(out);
}

export async function generateTicket({ requirement, memory, llm }) {
  const context = memory ? retrieve(memory, requirement) : [];
  const out = await chat({
    ...llm,
    system:
      'You are a senior product engineer writing development tickets. Ground everything in the repo profile and code excerpts: reference real files/modules, follow existing conventions, never invent components that contradict them. Acceptance criteria must be testable, in Given/When/Then form. Reply with JSON only: {"type":"story|bug|task","title":"","description":"","acceptanceCriteria":["Given... When... Then..."],"tasks":[""],"affectedFiles":[""],"risks":[""],"openQuestions":[""],"estimate":"S|M|L"}',
    user: `Repo profile:\n${JSON.stringify(memory?.profile ?? 'none')}\n\nRelevant code:\n${context.map((c) => `--- ${c.path}\n${c.text}`).join('\n') || 'none'}\n\nRequirement:\n${requirement}`,
  });
  return parseJSON(out);
}

// Exports for the ticket systems you mentioned
export const toJira = (t) => ({
  fields: {
    summary: t.title,
    issuetype: { name: t.type === 'bug' ? 'Bug' : t.type === 'task' ? 'Task' : 'Story' },
    description: `${t.description}\n\nAcceptance criteria:\n${t.acceptanceCriteria.map((a) => `* ${a}`).join('\n')}\n\nTasks:\n${t.tasks.map((a) => `* ${a}`).join('\n')}`,
  },
});
export const toDevOps = (t) => [
  { op: 'add', path: '/fields/System.Title', value: t.title },
  { op: 'add', path: '/fields/System.Description', value: t.description },
  { op: 'add', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: `<ul>${t.acceptanceCriteria.map((a) => `<li>${a}</li>`).join('')}</ul>` },
];
