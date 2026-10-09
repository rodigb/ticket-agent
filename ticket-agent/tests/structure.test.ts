import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { askForJSON } from '../src/agent/askForJSON';
import { TicketSchema, ticketJsonSchema } from '../src/agent/schemas';
import { chat } from '../src/llm/providers';

const llm = { provider: 'ollama', model: 'm', apiKey: '' } as const;
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const ticket = {
  type: 'story', title: 'T', description: 'D', acceptanceCriteria: ['Given a, When b, Then c'],
  tasks: [], affectedFiles: [], newFiles: [], risks: [], openQuestions: [], estimate: 'M',
};

interface Sent { format: unknown; options: Record<string, unknown> }
// Each reply is an HTTP status plus the content Ollama would return.
function mockOllama(replies: { status: number; content?: string }[]): Sent[] {
  const sent: Sent[] = [];
  let i = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    const r = replies[Math.min(i++, replies.length - 1)];
    return new Response(JSON.stringify({ message: { content: r.content ?? '' } }), { status: r.status });
  }) as typeof fetch;
  return sent;
}

describe('ticketJsonSchema', () => {
  it('lists every ticket field as required', () => {
    const props = Object.keys((ticketJsonSchema.properties as object) ?? {});
    assert.deepEqual(props.sort(), Object.keys(TicketSchema.shape).sort());
    assert.deepEqual([...(ticketJsonSchema.required as string[])].sort(), props.sort());
  });
  it('keeps the enums and minimums, and drops $schema and default', () => {
    const text = JSON.stringify(ticketJsonSchema);
    assert.match(text, /"enum":\["S","M","L"\]/);
    assert.match(text, /"minItems":1/);
    assert.doesNotMatch(text, /\$schema|"default"/);
  });
});

describe('chat with a JSON schema', () => {
  it('sends the schema as format, and "json" when none is given', async () => {
    const sent = mockOllama([{ status: 200, content: '{}' }]);
    await chat({ ...llm, system: 's', user: 'u', jsonSchema: { type: 'object' } });
    await chat({ ...llm, system: 's', user: 'u' });
    assert.deepEqual(sent[0].format, { type: 'object' });
    assert.equal(sent[1].format, 'json');
    assert.equal(sent[0].options.num_ctx, 8192);
  });

  it('falls back to plain json on a 400 and says so', async () => {
    const sent = mockOllama([{ status: 400 }, { status: 200, content: '{"ok":true}' }]);
    let fellBack = 0;
    const out = await chat({ ...llm, system: 's', user: 'u', jsonSchema: { type: 'object' }, onFallback: () => fellBack++ });
    assert.equal(out, '{"ok":true}');
    assert.equal(fellBack, 1);
    assert.deepEqual(sent.map((s) => s.format), [{ type: 'object' }, 'json']);
  });

  it('does not retry on a server error', async () => {
    const sent = mockOllama([{ status: 500 }]);
    await assert.rejects(chat({ ...llm, system: 's', user: 'u', jsonSchema: { type: 'object' } }), /Ollama error 500/);
    assert.equal(sent.length, 1);
  });
});

describe('askForJSON with a schema', () => {
  it('sends the schema on both attempts and reports the attempt count', async () => {
    const sent = mockOllama([{ status: 200, content: JSON.stringify({ ...ticket, title: '' }) }, { status: 200, content: JSON.stringify(ticket) }]);
    const attempts: number[] = [];
    const out = await askForJSON(llm, { system: 's', user: 'u' }, TicketSchema, { onAttempt: (n) => attempts.push(n), jsonSchema: ticketJsonSchema });
    assert.equal(out.title, 'T');
    assert.deepEqual(attempts, [1, 2]);
    assert.ok(sent.every((s) => typeof s.format === 'object'));
    assert.equal(sent[0].options.temperature, 0);
    assert.equal(sent[1].options.temperature, 0.3);
  });
});