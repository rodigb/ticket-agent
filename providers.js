// Every provider exposes the same call: chat({ provider, model, apiKey, system, user }) -> string
export const PROVIDERS = {
  ollama: { label: 'Ollama (local, free)', needsKey: false },
  anthropic: {
    label: 'Anthropic (API key)',
    needsKey: true,
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5-20251001'],
  },
};

const OLLAMA = 'http://localhost:11434'; // run Ollama with OLLAMA_ORIGINS=* so the browser may call it

export async function listOllamaModels() {
  const r = await fetch(`${OLLAMA}/api/tags`);
  if (!r.ok) throw new Error('Ollama not reachable');
  return (await r.json()).models.map((m) => m.name);
}

export async function chat({ provider, model, apiKey, system, user }) {
  if (provider === 'ollama') {
    const r = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model, stream: false, format: 'json',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) throw new Error(`Ollama error ${r.status}`);
    return (await r.json()).message.content;
  }
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
  return (await r.json()).content.map((b) => b.text || '').join('');
}
