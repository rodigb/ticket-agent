# Skills

Reusable instructions, one folder per skill, each containing a `SKILL.md`.

```
skills/
├── write-ticket/SKILL.md    for the ticket agent (the LLM inside the app)
├── run-eval/SKILL.md        for coding agents working on this repo
└── add-provider/SKILL.md    for coding agents working on this repo
```

## Format

```markdown
---
name: folder-name
description: What it does and when to use it. This line is how an agent decides to load the skill.
---

# Title
Instructions…
```

The `name` must match the folder name. Keep the description to one or two sentences and say *when* to use the skill. Keep the body short: local models have small context windows.

## Using them

- **Coding agents (Claude Code, Cursor, etc.):** point the tool at this folder. Claude Code looks for project skills in `.claude/skills/`, so link or copy this folder there.
- **The ticket agent:** `src/agent/skills.ts` parses a skill and formats it for a prompt. Feeding a skill to the model changes the prompt, so bump `PROMPT_VERSION` and run the eval first.