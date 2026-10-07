import { useState, useEffect, useCallback } from "react";
import { PROVIDERS, listOllamaModels } from "../llm/providers";
import { indexRepo, loadMemory, saveMemory } from "../repo/repo";
import { parseRepoInput } from "../repo/parseRepo";
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
  page: "relative mx-auto max-w-3xl px-5 pt-10 pb-16 text-body",
  topBar: "mb-4 flex items-center justify-between",
  back: "text-sm text-accent hover:underline",
  cog: "rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  title: "text-3xl font-semibold tracking-tight",
  subtitle: "mt-1 mb-8 text-muted",
  section: "border-t border-line py-5",
  sectionTitle: "mb-2 text-lg font-semibold",
  row: "mb-2 flex flex-wrap gap-2",
  control:
    "mb-2 rounded-md border border-line bg-transparent px-3 py-2 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  rowControl: "grow basis-40",
  fullControl: "w-full",
  button:
    "rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40",
  secondaryButton:
    "rounded-md border border-line px-3 py-2 text-sm hover:bg-surface",
  note: "text-sm text-muted",
  error: "text-red-700 dark:text-red-400",
  ticket: "mt-4 rounded-lg border border-line bg-surface p-5",
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

  const repoRef = parseRepoInput(repo);

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

  const index = () => {
    if (!repoRef) return;
    return run("Reading repo…", async () => {
      const m = await indexRepo(repoRef.slug, ghToken, (i, n) =>
        setStatus(`Reading files ${i}/${n}…`),
      );
      setStatus("Profiling codebase…");
      m.profile = await buildProfile(m, llm);
      saveMemory(m);
      setMemory(m);
    });
  };

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
      <div className={styles.topBar}>
        <Link to={ROUTES.home} className={styles.back}>
          ← Home
        </Link>
        <button
          type="button"
          className={styles.cog}
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            width={22}
            height={22}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </div>
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
            placeholder="GitHub URL or owner/repo"
            value={repo}
            onChange={(e) => {
              setRepo(e.target.value);
              const ref = parseRepoInput(e.target.value);
              setMemory(ref ? loadMemory(ref.slug) : null);
            }}
          />
          <input
            className={`${styles.control} ${styles.rowControl}`}
            type="password"
            placeholder="GitHub token (optional, for private repos)"
            value={ghToken}
            onChange={(e) => setGhToken(e.target.value)}
          />
          <button
            className={styles.button}
            onClick={index}
            disabled={!repoRef || !model || !!status}
          >
            {memory ? "Re-index" : "Index repo"}
          </button>
        </div>
        {repo && !repoRef && (
          <p className={styles.error}>
            Enter a GitHub URL such as https://github.com/owner/repo, or
            owner/repo.
          </p>
        )}
        {repoRef && !memory && (
          <p className={styles.note}>Will read {repoRef.slug}.</p>
        )}
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
