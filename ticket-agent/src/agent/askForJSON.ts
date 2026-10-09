import type { ZodType } from 'zod';
import { chat } from '../llm/providers';
import type { LLMConfig } from '../types';
import { retryNote, type Prompt } from './prompts';

const RETRY_TEMPERATURE = 0.3; // first attempt is deterministic; the retry needs room to differ

export interface AskOptions {
  onAttempt?: (attempt: number) => void;
  jsonSchema?: Record<string, unknown>; // constrain Ollama's output to this schema
  onFallback?: () => void; // the schema was rejected and plain JSON mode was used instead
}

// Small models often wrap JSON in fences or prose, so take the outermost {...} block.
const extractJSON = (s: string): unknown => {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object found');
  return JSON.parse(s.slice(start, end + 1));
};

// Ask the model, validate against the schema, and on failure retry once with the error fed back.
// The zod check stays even with a JSON Schema: constrained output guarantees the shape, not the content.
export async function askForJSON<T>(
  llm: LLMConfig,
  prompt: Prompt,
  schema: ZodType<T>,
  opts: AskOptions = {},
): Promise<T> {
  let user = prompt.user;
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    opts.onAttempt?.(attempt + 1);
    const out = await chat({
      ...llm,
      system: prompt.system,
      user,
      temperature: attempt === 0 ? undefined : RETRY_TEMPERATURE,
      jsonSchema: opts.jsonSchema,
      onFallback: opts.onFallback,
    });
    try {
      const parsed = schema.safeParse(extractJSON(out));
      if (parsed.success) return parsed.data;
      problem = parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    }
    user = prompt.user + retryNote(problem);
  }
  throw new Error(`The model returned invalid output twice (${problem}). Try a larger model.`);
}