import { useState, useEffect, useCallback } from "react";
import { PROVIDERS, listOllamaModels } from "../llm/providers";
import { indexRepo, loadMemory, saveMemory } from "../repo/repo";
import { buildProfile, generateTicket } from "../agent/ticketAgent";
import { loadSkillsBrowser } from "../agent/loadSkillsBrowser";
import { pickSkills } from "../agent/skills";
import { toJira, toDevOps } from "../export/exporters";
import { Link } from "react-router-dom";
import { ROUTES } from "../routes";
import { SettingsModal } from "../components/Settings";
import { TicketEditor } from "../components/TicketEditor";
import { TracePanel } from "../components/TracePanel";
import type {
  LLMConfig,
  ProviderId,
  RepoMemory,
  Ticket,
  TraceInfo,
} from "../types";

const styles = {
  page: "mx-auto max-w-3xl px-5 pt-10 pb-16 text-slate-900 dark:text-slate-100",
  back: "mb-4 inline-block text-sm text-blue-700 hover:underline dark:text-blue-400",
  title: "text-3xl font-semibold tracking-tight",
  subtitle: "mt-1 mb-8 text-slate-500 dark:text-slate-400",
  section: "border-t border-slate-200 py-5 dark:border-slate-800",
  sectionTitle: "mb-2 text-lg font-semibold",
  row: "mb-2 flex flex-wrap gap-2",
  control:
    "mb-2 rounded-md border border-slate-300 bg-transparent px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-100",
  rowControl: "grow basis-40",
  fullControl: "w-full",
  button:
    "rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40",
  secondaryButton:
    "rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
  note: "text-sm text-slate-500 dark:text-slate-400",
  error: "text-red-700 dark:text-red-400",
  ticket: "mt-4 rounded-lg border border-slate-200 p-5 dark:border-slate-800",
};

export default function TicketPage() {
  const [provider, setProvider] = useState<ProviderId>("ollama");
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState<string>("");
  const [repo, setRepo] = useState<string>("");
  const [ghToken, setGhToken] = useState<string>("");
  const [memory, setMemory] = useState<RepoMemory | null>(null);
  const [requirement, setRequirement] = useState<string>("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [trace, setTrace] = useState<TraceInfo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const llm: LLMConfig = { provider, model, apiKey };

  const loadModels = useCallback((p: ProviderId) => {
    setModelsError("");
    if (p === "anthropic") {
      const list = [...PROVIDERS.anthropic.models];
      setModels(list);
      setModel(list[0]);
      return;
    }
    listOllamaModels()
      .then((m) => {
        setModels(m);
        setModel(m[0] ?? "");
      })
      .catch(() => {
        setModels([]);
        setModel("");
        setModelsError(
          "Ollama is not reachable on localhost:11434. Start it with OLLAMA_ORIGINS=* ollama serve, then refresh.",
        );
      });
  }, []);

  useEffect(() => {
    loadModels(provider);
  }, [provider, loadModels]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setError("");
    setStatus(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus("");
    }
  };

  const index = () =>
    run("Reading repo…", async () => {
      const m = await indexRepo(repo.trim(), ghToken, (i, n) =>
        setStatus(`Reading files ${i}/${n}…`),
      );
      setStatus("Profiling codebase…");
      m.profile = await buildProfile(m, llm);
      saveMemory(m);
      setMemory(m);
    });

  const generate = () =>
    run("Writing ticket…", async () => {
      const started = Date.now();
      let attempts = 0;
      let seen: { chunkPaths: string[]; skillNames: string[] } = {
        chunkPaths: [],
        skillNames: [],
      };
      const t = await generateTicket({
        requirement,
        memory,
        llm,
        skills: pickSkills(loadSkillsBrowser(), ["write-ticket"]),
        onAttempt: (n) => {
          attempts = n;
        },
        onContext: (info) => {
          seen = info;
        },
      });
      setTicket(t);
      setTrace({ ...seen, attempts, seconds: (Date.now() - started) / 1000 });
    });

  const download = (obj: unknown, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }),
    );
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className={styles.page}>
      <Link to={ROUTES.home} className={styles.back}>
        ← Home
      </Link>
      <h1 className={styles.title}>Ticket creation</h1>
      <p className={styles.subtitle}>
        Describe the work. Get a ticket that fits your codebase.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Model</h2>
        <div className={styles.row}>
          <p className={`${styles.note} grow self-center`}>
            {PROVIDERS[provider].label}: {model || "no model selected"}
            {PROVIDERS[provider].needsKey && !apiKey && " (API key needed)"}
          </p>
          <button
            className={styles.secondaryButton}
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
        </div>
        {modelsError && <p className={styles.error}>{modelsError}</p>}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Repository</h2>
        <div className={styles.row}>
          <input
            className={`${styles.control} ${styles.rowControl}`}
            placeholder="owner/repo"
            value={repo}
            onChange={(e) => {
              setRepo(e.target.value);
              setMemory(loadMemory(e.target.value.trim()));
            }}
          />
          <input
            className={`${styles.control} ${styles.rowControl}`}
            type="password"
            placeholder="GitHub token (private repos)"
            value={ghToken}
            onChange={(e) => setGhToken(e.target.value)}
          />
          <button
            className={styles.button}
            onClick={index}
            disabled={!repo || !model || !!status}
          >
            {memory ? "Re-index" : "Index repo"}
          </button>
        </div>
        {memory && (
          <div className={styles.note}>
            Remembered {memory.paths.length} files, {memory.chunks.length}{" "}
            chunks. Stack: {memory.profile?.stack.join(", ") || "unknown"}.
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Requirement</h2>
        <textarea
          className={`${styles.control} ${styles.fullControl}`}
          rows={5}
          placeholder="e.g. Let users reset their password by email"
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
        />
        <button
          className={styles.button}
          onClick={generate}
          disabled={!requirement || !model || !!status}
        >
          Create ticket
        </button>
      </section>

      {status && <p className={styles.note}>{status}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {ticket && (
        <article className={styles.ticket}>
          <TicketEditor ticket={ticket} onChange={setTicket} />
          <div className={styles.row}>
            <button
              className={styles.button}
              onClick={() => download(toJira(ticket), "ticket-jira.json")}
            >
              Export for Jira
            </button>
            <button
              className={styles.button}
              onClick={() => download(toDevOps(ticket), "ticket-devops.json")}
            >
              Export for Azure DevOps
            </button>
          </div>
          {trace && <TracePanel trace={trace} />}
        </article>
      )}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        provider={provider}
        onProviderChange={setProvider}
        model={model}
        models={models}
        onModelChange={setModel}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        modelsError={modelsError}
        onRefreshModels={() => loadModels(provider)}
      />
    </main>
  );
}
