import type { LLMConfig, ProviderId } from '../types';

// Every provider exposes the same call: chat({ provider, model, apiKey, system, user }) -> string
interface ProviderInfo {
  label: string;
  needsKey: boolean;
  models?: readonly string[];
}

export const PROVIDERS = {
  ollama: { label: 'Ollama (local, free)', needsKey: false },
  anthropic: {
    label: 'Anthropic (API key)',
    needsKey: true,
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5-20251001'],
  },
} as const satisfies Record<ProviderId, ProviderInfo>;

const OLLAMA = 'http://localhost:11434'; // run Ollama with OLLAMA_ORIGINS=* so the browser may call it

// Only the response fields we read
interface OllamaTagsResponse { models: { name: string }[] }
interface OllamaChatResponse { message: { content: string } }
interface AnthropicResponse { content: { type: string; text?: string }[] }

export async function listOllamaModels(): Promise<string[]> {
  const r = await fetch(`${OLLAMA}/api/tags`);
  if (!r.ok) throw new Error('Ollama not reachable');
  const data: OllamaTagsResponse = await r.json();
  return data.models.map((m) => m.name);
}

export interface ChatArgs extends LLMConfig {
  system: string;
  user: string;
  temperature?: number; // Ollama only; defaults to 0 for repeatable runs
  // Ollama only: constrain the reply to this JSON Schema instead of free-form JSON.
  jsonSchema?: Record<string, unknown>;
  // Called when Ollama rejected the schema and the request was repeated in plain JSON mode.
  onFallback?: () => void;
}

export async function chat({ provider, model, apiKey, system, user, temperature, jsonSchema, onFallback }: ChatArgs): Promise<string> {
  if (provider === 'ollama') {
    const post = (format: 'json' | Record<string, unknown>) =>
      fetch(`${OLLAMA}/api/chat`, {
        method: 'POST',
        body: JSON.stringify({
          model,
          stream: false,
          format,
          // Ollama silently truncates prompts beyond num_ctx, so set it explicitly.
          // temperature 0 + fixed seed keeps eval runs repeatable.
          options: { num_ctx: 8192, temperature: temperature ?? 0, seed: 42 },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    let r = await post(jsonSchema ?? 'json');
    // Older Ollama versions only accept format: "json" and answer 400 to a schema.
    if (r.status === 400 && jsonSchema) {
      onFallback?.();
      r = await post('json');
    }
    if (!r.ok) throw new Error(`Ollama error ${r.status}`);
    const data: OllamaChatResponse = await r.json();
    return data.message.content;
  }

  if (!apiKey) throw new Error('Add your Anthropic API key to use this model.');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', // dev only: move behind a backend later
    },
    body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error(`Anthropic error ${r.status}: ${await r.text()}`);
  const data: AnthropicResponse = await r.json();
  return data.content.map((b) => b.text ?? '').join('');
}