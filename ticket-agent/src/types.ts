import type { RepoProfile } from './agent/schemas';

export type { Ticket, RepoProfile } from './agent/schemas';

export type ProviderId = 'ollama' | 'anthropic';

export interface LLMConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
}

export interface Chunk { path: string; text: string }

export interface RepoMemory {
  repo: string;
  description: string | null;
  paths: string[];
  chunks: Chunk[];
  profile: RepoProfile | null;
  indexedAt: number;
}

export type TicketListKey = 'acceptanceCriteria' | 'tasks' | 'affectedFiles' | 'newFiles' | 'risks' | 'openQuestions';

// What went into one ticket generation, shown in the trace panel.
export interface TraceInfo {
  chunkPaths: string[];
  skillNames: string[];
  attempts: number;
  seconds: number;
}