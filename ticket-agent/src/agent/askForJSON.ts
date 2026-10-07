import type { ZodType } from 'zod';
import { chat } from '../llm/providers';
import type { LLMConfig } from '../types';
import { retryNote, type Prompt } from './prompts';

// Small models often wrap JSON in fences or prose, so take the outermost {...} block.
const extractJSON = (s: string): unknown => {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object found');
  return JSON.parse(s.slice(start, end + 1));
};

// Ask the model, validate against the schema, and on failure retry once with the error fed back.
export async function askForJSON<T>(
  llm: LLMConfig,
  prompt: Prompt,
  schema: ZodType<T>,
  onAttempt?: (attempt: number) => void,
): Promise<T> {
  let user = prompt.user;
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    onAttempt?.(attempt + 1);
    const out = await chat({ ...llm, system: prompt.system, user });
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