import { z } from 'zod';

// Lenient where a small model's slip is harmless (missing optional lists, odd enum values),
// strict where the ticket would be useless without it (title, description, criteria).
const list = z.array(z.string()).default([]);

export const TicketSchema = z.object({
  type: z.enum(['story', 'bug', 'task']).catch('story'),
  title: z.string().min(1),
  description: z.string().min(1),
  acceptanceCriteria: z.array(z.string()).min(1),
  tasks: list,
  affectedFiles: list,
  newFiles: list,
  risks: list,
  openQuestions: list,
  estimate: z.enum(['S', 'M', 'L']).catch('M'),
});

// The profile is context we feed back into the ticket prompt, not a contract anyone consumes,
// so it accepts whatever shape a small model produces and flattens it to text.
const toText = (x: unknown): string =>
  typeof x === 'string'
    ? x
    : x && typeof x === 'object'
      ? Object.entries(x as Record<string, unknown>).map(([k, v]) => `${k}: ${toText(v)}`).join(', ')
      : String(x ?? '');
const flexText = z.preprocess((v) => (Array.isArray(v) ? v.map(toText).join('; ') : toText(v)), z.string());
const flexList = z.preprocess((v) => (v == null ? [] : (Array.isArray(v) ? v : [v]).map(toText)), z.array(z.string()));

export const RepoProfileSchema = z.object({
  stack: flexList,
  structure: flexText,
  conventions: flexList,
  testing: flexText,
  notes: flexText,
});

// JSON Schema for Ollama's constrained decoding, derived from TicketSchema so the two cannot drift.
// io: 'output' makes every field required, so the model must emit all of them. "$schema" and
// "default" are dropped because they add nothing to the grammar Ollama builds from this.
const stripKeys = (node: unknown): unknown =>
  Array.isArray(node)
    ? node.map(stripKeys)
    : node && typeof node === 'object'
      ? Object.fromEntries(
          Object.entries(node)
            .filter(([k]) => k !== '$schema' && k !== 'default')
            .map(([k, v]) => [k, stripKeys(v)]),
        )
      : node;

export const ticketJsonSchema = stripKeys(z.toJSONSchema(TicketSchema, { io: 'output' })) as Record<string, unknown>;

export type Ticket = z.infer<typeof TicketSchema>;
export type RepoProfile = z.infer<typeof RepoProfileSchema>;