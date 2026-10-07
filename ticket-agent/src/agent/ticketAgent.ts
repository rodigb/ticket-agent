import { retrieve } from '../repo/repo';
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
  onAttempt?: (attempt: number) => void;
}

export function generateTicket({ requirement, memory, llm, onAttempt }: GenerateTicketArgs): Promise<Ticket> {
  const context = memory ? retrieve(memory, requirement) : [];
  return askForJSON(
    llm,
    ticketPrompt({ requirement, profile: memory?.profile ?? null, context }),
    TicketSchema,
    onAttempt,
  );
}