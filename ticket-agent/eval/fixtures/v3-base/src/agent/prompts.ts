import type { Chunk, RepoProfile } from '../types';
import { formatSkills, type Skill } from './skills';

// Bump this whenever any prompt below changes, and record it with every eval run
// so a metric change can be traced to a prompt change.
// v1: baseline.
// v2: ticket prompt sees the real file list; asks for every affected file; separate newFiles;
//     explicit non-empty description rule; more specific retry note.
// v3: ticket RULES moved out of code into skills/*/SKILL.md, loaded at runtime. The JSON shape stays here.
// NOTE: editing a SKILL.md now changes behaviour without touching code; eval results record a skills hash.
export const PROMPT_VERSION = 'v3';

export interface Prompt { system: string; user: string }

// The JSON shapes below must stay in sync with schemas.ts. They live in code, not markdown,
// so a markdown edit can never break validation.

const PROFILE_SYSTEM =
  'You analyse codebases. Reply with JSON only: {"stack":[],"structure":"","conventions":[],"testing":"","notes":""}. All values are strings or arrays of strings. Be concrete and brief.';

const TICKET_INTRO =
  "You are a senior engineer writing a development ticket for an existing codebase. Ground everything in the repo profile, the file list and the code excerpts, and follow the repo's existing conventions.";

const TICKET_SHAPE = `Reply with JSON only, in exactly this shape:
{"type":"story|bug|task","title":"","description":"","acceptanceCriteria":["Given ... When ... Then ..."],"tasks":[""],"affectedFiles":["path/from/file/list"],"newFiles":[],"risks":[""],"openQuestions":[""],"estimate":"S|M|L"}`;

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
  paths: string[];
  context: Chunk[];
  skills: Skill[];
}): Prompt {
  return {
    // intro, then the guidance, then the shape last so "reply with JSON" is the final instruction
    system: `${TICKET_INTRO}${formatSkills(a.skills)}\n\n${TICKET_SHAPE}`,
    user: `Repo profile:\n${JSON.stringify(a.profile ?? 'none')}\n\nFiles in the repo:\n${
      a.paths.slice(0, 150).join('\n') || 'none'
    }\n\nRelevant code:\n${formatChunks(a.context) || 'none'}\n\nRequirement:\n${a.requirement}`,
  };
}

// Appended to the user prompt when the first reply fails validation.
export const retryNote = (problem: string): string =>
  `\n\nYour previous reply was invalid: ${problem}. Fix exactly those problems and reply with the complete corrected JSON only, no other text.`;