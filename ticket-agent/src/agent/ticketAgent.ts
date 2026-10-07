import { retrieve } from '../repo/repo';
import type { Skill } from './skills';
import type { LLMConfig, RepoMemory, RepoProfile, Ticket } from '../types';
import { askForJSON } from './askForJSON';
import { profilePrompt, ticketPrompt } from './prompts';
import { RepoProfileSchema, TicketSchema } from './schemas';

// Run once after indexing: a compact "what kind of codebase is this" note kept in memory.
export function buildProfile(memory: RepoMemory, llm: LLMConfig): Promise<RepoProfile> {
  const keyChunks = memory.chunks
    .filter((c) => /README|package\.json|pyproject|go\.mod|pom\.xml/i.test(c.path))
    .slice(0, 6);
  return askForJSON(
    llm,
    profilePrompt({ repo: memory.repo, description: memory.description, paths: memory.paths, keyChunks }),
    RepoProfileSchema,
  );
}

interface GenerateTicketArgs {
  requirement: string;
  memory: RepoMemory | null;
  llm: LLMConfig;
  skills: Skill[];
  onAttempt?: (attempt: number) => void;
  onContext?: (info: { chunkPaths: string[]; skillNames: string[] }) => void;
}

export function generateTicket({ requirement, memory, llm, skills, onAttempt, onContext }: GenerateTicketArgs): Promise<Ticket> {
  const context = memory ? retrieve(memory, requirement) : [];
  onContext?.({ chunkPaths: context.map((c) => c.path), skillNames: skills.map((s) => s.name) });
  return askForJSON(
    llm,
    ticketPrompt({ requirement, profile: memory?.profile ?? null, paths: memory?.paths ?? [], context, skills }),
    TicketSchema,
    onAttempt,
  );
}