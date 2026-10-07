---
name: add-provider
description: How to add a new model provider (for example OpenAI or a self-hosted endpoint) to the app. Use when asked to support another LLM backend.
---

# Adding a model provider

All model calls go through `chat()` in `src/llm/providers.ts`. Never call a model API anywhere else.

## Steps

1. `src/types.ts`: add the provider id to `ProviderId`.
2. `src/llm/providers.ts`:
   - Add an entry to `PROVIDERS` with `label`, `needsKey`, and `models` if the list is fixed.
   - Add a typed response interface for only the fields you read.
   - Add a branch in `chat()` that returns the reply as a plain string. Throw a clear error if a required key is missing.
3. `src/App.tsx`: the API key input is shown when `needsKey` is true. Update its placeholder if it names a specific provider.
4. Keep `format`/JSON-mode options on if the provider supports them; reply validation is still done by `askForJSON`.

## Checks

- `npx tsc --noEmit` passes with no `any`.
- Never log or persist API keys.
- Run one eval case against the new provider before a full run.
- Update the Stack and Known limitations sections of `AGENTS.md`.
