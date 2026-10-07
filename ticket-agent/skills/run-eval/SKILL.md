---
name: run-eval
description: How to run and interpret the ticket-agent evaluation in eval/. Use when changing prompts, retrieval, schemas or models and you need to measure the effect.
---

# Running the evaluation

## Run

1. Start Ollama: `OLLAMA_ORIGINS=* ollama serve`, and pull the model.
2. `npm run eval -- --provider ollama --model llama3.1`
3. Results are saved to `eval/results/` stamped with model, `PROMPT_VERSION` and retrieval method.

## Metrics

- **valid output / valid first try:** schema pass rate, and how often no retry was needed.
- **file recall (ticket):** expected files the ticket named.
- **file recall (retrieval alone):** expected files `retrieve()` surfaced. If this is high and ticket recall is low, the model is the problem, not retrieval.
- **invented files:** named paths that do not exist in the repo. New files belong in `newFiles`, not `affectedFiles`.
- **infra errors:** server failures such as Ollama 500. Not a model-quality signal; investigate separately.

## Rules

- Change ONE thing per run (a prompt, the retriever, the model, or a metric), never several, or the result cannot be attributed.
- Bump `PROMPT_VERSION` whenever any prompt changes.
- Never index `eval/`; the answer key must not reach retrieval.
- Runs use temperature 0 and a fixed seed, so a repeat of the same setup should reproduce.
- Commit the results files. They are the evidence.
- `eval/cases.json` expectations are judgement calls. If a miss looks reasonable, fix the case, not the model.
