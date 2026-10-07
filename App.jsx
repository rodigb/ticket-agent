import { useState, useEffect } from 'react';
import { PROVIDERS, listOllamaModels } from './providers.js';
import { indexRepo, loadMemory, saveMemory } from './repo.js';
import { buildProfile, generateTicket, toJira, toDevOps } from './agent.js';

export default function App() {
  const [provider, setProvider] = useState('ollama');
  const [model, setModel] = useState('');
  const [models, setModels] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [repo, setRepo] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [memory, setMemory] = useState(null);
  const [requirement, setRequirement] = useState('');
  const [ticket, setTicket] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const llm = { provider, model, apiKey };

  useEffect(() => {
    setError('');
    if (provider === 'anthropic') { setModels(PROVIDERS.anthropic.models); setModel(PROVIDERS.anthropic.models[0]); return; }
    listOllamaModels().then((m) => { setModels(m); setModel(m[0] || ''); })
      .catch(() => { setModels([]); setError('Ollama is not reachable on localhost:11434. Start it with OLLAMA_ORIGINS=* ollama serve.'); });
  }, [provider]);

  const run = async (label, fn) => {
    setError(''); setStatus(label);
    try { await fn(); } catch (e) { setError(e.message); } finally { setStatus(''); }
  };

  const index = () => run('Reading repo…', async () => {
    const m = await indexRepo(repo.trim(), ghToken, (i, n) => setStatus(`Reading files ${i}/${n}…`));
    setStatus('Profiling codebase…');
    m.profile = await buildProfile(m, llm);
    saveMemory(m); setMemory(m);
  });

  const generate = () => run('Writing ticket…', async () => setTicket(await generateTicket({ requirement, memory, llm })));
  const download = (obj, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    a.download = name; a.click();
  };

  return (
    <main>
      <h1>Ticket agent</h1>
      <p className="sub">Describe the work. Get a ticket that fits your codebase.</p>

      <section>
        <h2>Model</h2>
        <div className="row">
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        {PROVIDERS[provider].needsKey && (
          <input type="password" placeholder="Anthropic API key (kept in this tab only)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        )}
      </section>

      <section>
        <h2>Repository</h2>
        <div className="row">
          <input placeholder="owner/repo" value={repo} onChange={(e) => { setRepo(e.target.value); setMemory(loadMemory(e.target.value.trim())); }} />
          <input type="password" placeholder="GitHub token (private repos)" value={ghToken} onChange={(e) => setGhToken(e.target.value)} />
          <button onClick={index} disabled={!repo || !model || !!status}>{memory ? 'Re-index' : 'Index repo'}</button>
        </div>
        {memory && (
          <div className="memory">
            Remembered {memory.paths.length} files, {memory.chunks.length} chunks. Stack: {memory.profile?.stack?.join(', ') || 'unknown'}.
          </div>
        )}
      </section>

      <section>
        <h2>Requirement</h2>
        <textarea rows={5} placeholder="e.g. Let users reset their password by email" value={requirement} onChange={(e) => setRequirement(e.target.value)} />
        <button onClick={generate} disabled={!requirement || !model || !!status}>Create ticket</button>
      </section>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}

      {ticket && (
        <article>
          <p className="kind">{ticket.type} · size {ticket.estimate}</p>
          <h2>{ticket.title}</h2>
          <p>{ticket.description}</p>
          {[['Acceptance criteria', 'acceptanceCriteria'], ['Tasks', 'tasks'], ['Affected files', 'affectedFiles'], ['Risks', 'risks'], ['Open questions', 'openQuestions']].map(([label, k]) =>
            ticket[k]?.length ? <div key={k}><h3>{label}</h3><ul>{ticket[k].map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null)}
          <div className="row">
            <button onClick={() => download(toJira(ticket), 'ticket-jira.json')}>Export for Jira</button>
            <button onClick={() => download(toDevOps(ticket), 'ticket-devops.json')}>Export for Azure DevOps</button>
          </div>
        </article>
      )}
    </main>
  );
}
