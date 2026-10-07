---
name: write-ticket
description: How to write a development ticket for an existing codebase. Use when turning a requirement into a ticket with acceptance criteria, tasks, affected files and an estimate.
---

# Writing a development ticket

## Title and description

- Title: imperative, under 80 characters ("Add priority to tickets", not "Priority").
- Description: 2-3 sentences. First what to build, then why. Never empty.

## Type

- `bug`: existing behaviour is wrong.
- `story`: new behaviour a user will notice.
- `task`: internal work with no visible change.

## Acceptance criteria

- 3-6 items, each ONE string in the form: Given <state>, When <action>, Then <observable result>.
- Each must be testable by someone who has not read the ticket.
- One behaviour per item. Include at least one failure or edge case.

## Files

- `affectedFiles`: every EXISTING file that must change. Check each layer: UI, types and schemas, prompts, exports, core logic. If a field is added or renamed, include every file that defines, produces, displays or exports it.
- `newFiles`: files to be created. Never list these as affected.
- Use exact paths from the repo file list. Never invent a path for an existing file.

## Tasks, risks, questions

- Tasks: ordered, each small enough to finish in one sitting.
- Risks: what could break or surprise (data migrations, shared code, performance).
- Open questions: anything the requirement leaves unclear. If the requirement is vague, ask instead of guessing.

## Estimate

- S: one file, under half a day.
- M: a few files, one to two days.
- L: cross-cutting, or over two days. Consider splitting.

## Example

Requirement: "Let users reset their password by email."

- Title: Add password reset by email
- Criteria: Given a registered email, When the user requests a reset, Then a single-use link is emailed. Given an expired link, When it is opened, Then the user sees an error and can request a new one.
- Open question: How long should reset links stay valid?
