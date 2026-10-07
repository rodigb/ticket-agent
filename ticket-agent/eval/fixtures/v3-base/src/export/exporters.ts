import type { Ticket } from '../types';

interface JiraIssue {
  fields: { summary: string; issuetype: { name: 'Bug' | 'Task' | 'Story' }; description: string };
}
interface DevOpsPatchOp { op: 'add'; path: string; value: string }

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const toJira = (t: Ticket): JiraIssue => ({
  fields: {
    summary: t.title,
    issuetype: { name: t.type === 'bug' ? 'Bug' : t.type === 'task' ? 'Task' : 'Story' },
    description: `${t.description}\n\nAcceptance criteria:\n${t.acceptanceCriteria
      .map((a) => `* ${a}`)
      .join('\n')}\n\nTasks:\n${t.tasks.map((a) => `* ${a}`).join('\n')}`,
  },
});

// Azure DevOps text fields are HTML, so model output is escaped before it goes in.
export const toDevOps = (t: Ticket): DevOpsPatchOp[] => [
  { op: 'add', path: '/fields/System.Title', value: t.title },
  { op: 'add', path: '/fields/System.Description', value: escapeHtml(t.description).replace(/\n/g, '<br>') },
  {
    op: 'add',
    path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
    value: `<ul>${t.acceptanceCriteria.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`,
  },
];