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
  risks: list,
  openQuestions: list,
  estimate: z.enum(['S', 'M', 'L']).catch('M'),
});

export const RepoProfileSchema = z.object({
  stack: list,
  structure: z.string().default(''),
  conventions: list,
  testing: z.string().default(''),
  notes: z.string().default(''),
});

export type Ticket = z.infer<typeof TicketSchema>;
export type RepoProfile = z.infer<typeof RepoProfileSchema>;