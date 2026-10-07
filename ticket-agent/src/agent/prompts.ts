import type { Chunk, RepoProfile } from '../types';

// Bump this whenever any prompt below changes, and record it with every eval run
// so a metric change can be traced to a prompt change.
export const PROMPT_VERSION = 'v1';

export interface Prompt { system: string; user: string }

// The JSON shapes below must stay in sync with schemas.ts.

const PROFILE_SYSTEM =
  'You analyse codebases. Reply with JSON only: {"stack":[],"structure":"","conventions":[],"testing":"","notes":""}. All values are strings or arrays of strings. Be concrete and brief.';

const TICKET_SYSTEM =
  'You are a senior product engineer writing development tickets. Ground everything in the repo profile and code excerpts: reference real files/modules, follow existing conventions, never invent components that contradict them. Acceptance criteria must be testable, in Given/When/Then form. Reply with JSON only: {"type":"story|bug|task","title":"","description":"","acceptanceCriteria":["Given... When... Then..."],"tasks":[""],"affectedFiles":[""],"risks":[""],"openQuestions":[""],"estimate":"S|M|L"}';

const formatChunks = (chunks: Chunk[]): string =>
  chunks.map((c) => `--- ${c.path}\n${c.text}`).join('\n');

export function profilePrompt(a: {
  repo: string;
  description: string | null;
  paths: string[];
  keyChunks: Chunk[];
}): Prompt {
  return {
    system: PROFILE_SYSTEM,
    user: `Repo: ${a.repo}\nDescription: ${a.description}\nFiles (first 150):\n${a.paths
      .slice(0, 150)
      .join('\n')}\n\nKey files:\n${formatChunks(a.keyChunks)}`,
  };
}

export function ticketPrompt(a: {
  requirement: string;
  profile: RepoProfile | null;
  context: Chunk[];
}): Prompt {
  return {
    system: TICKET_SYSTEM,
    user: `Repo profile:\n${JSON.stringify(a.profile ?? 'none')}\n\nRelevant code:\n${
      formatChunks(a.context) || 'none'
    }\n\nRequirement:\n${a.requirement}`,
  };
}

// Appended to the user prompt when the first reply fails validation.
export const retryNote = (problem: string): string =>
  `\n\nYour previous reply was invalid (${problem}). Reply again with corrected JSON only, no other text.`;