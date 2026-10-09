import { useState, useEffect, useCallback } from "react";
import { PROVIDERS, listOllamaModels } from "../llm/providers";
import { indexRepo, loadMemory, saveMemory } from "../repo/repo";
import { parseRepoInput } from "../repo/parseRepo";
import { buildProfile, generateTicket } from "../agent/ticketAgent";
import { loadSkillsBrowser } from "../agent/loadSkillsBrowser";
import { pickSkills } from "../agent/skills";
import { Link } from "react-router-dom";
import { ROUTES } from "../routes";
import { SettingsModal } from "../components/Settings";
import { ExportMenu } from "../components/ExportMenu";
import { toJira, toDevOps } from "../export/exporters";
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
  page: "relative mx-auto w-full max-w-7xl px-4 pt-6 pb-16 text-left text-body sm:px-6 sm:pt-10 lg:px-8",
  topBar: "mb-6 flex items-center justify-between",
  back: "-ml-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  cog: "rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  // Important modifiers: the unlayered h1/h2 rules in index.css would otherwise beat Tailwind utilities.
  sectionTitle: "m-0! text-lg! leading-normal! font-semibold! tracking-normal!",
  control:
    "mb-3 min-h-40 w-full resize-y rounded-lg border border-line bg-background px-3 py-2.5 text-body placeholder:text-muted/70 transition-colors focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/40",
  button:
    "inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto",
  note: "mt-4 flex items-center gap-2 text-sm text-muted",
  error:
    "mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  columns:
    "grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8",
  panel: "rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6",
  stickyPanel: "lg:sticky lg:top-6",
  panelHeader:
    "mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-line pb-4",
  headerActions: "flex flex-wrap items-center gap-2",
  toggle:
    "rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  empty:
    "flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-4 py-12 text-center text-sm text-muted",
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
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
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
          <span aria-hidden="true">←</span> Home
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
      <div className={styles.columns}>
        <section
          className={`${styles.panel} ${styles.stickyPanel}`}
          aria-labelledby="requirement-title"
        >
          <div className={styles.panelHeader}>
            <h1 id="requirement-title" className={styles.sectionTitle}>
              Requirement
            </h1>
          </div>
          <textarea
            className={styles.control}
            rows={5}
            aria-labelledby="requirement-title"
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
          {status && (
            <p className={styles.note} role="status">
              <svg
                viewBox="0 0 24 24"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="animate-spin"
                aria-hidden="true"
              >
                <path d="M12 3a9 9 0 1 0 9 9" />
              </svg>
              {status}
            </p>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="results-title">
          <div className={styles.panelHeader}>
            <h2 id="results-title" className={styles.sectionTitle}>
              Results
            </h2>
            <div className={styles.headerActions}>
              {ticket && (
                <button
                  type="button"
                  className={styles.toggle}
                  aria-expanded={detailsOpen}
                  aria-controls="ticket-details"
                  onClick={() => setDetailsOpen((o) => !o)}
                >
                  {detailsOpen ? "Show less" : "Show more details"}
                </button>
              )}
              <ExportMenu
                disabled={!ticket}
                options={[
                  {
                    label: "Export for Jira",
                    hint: "Downloads ticket-jira.json",
                    onSelect: () =>
                      ticket && download(toJira(ticket), "ticket-jira.json"),
                  },
                  {
                    label: "Export for Azure DevOps",
                    hint: "Downloads ticket-devops.json",
                    onSelect: () =>
                      ticket &&
                      download(toDevOps(ticket), "ticket-devops.json"),
                  },
                ]}
              />
            </div>
          </div>
          {ticket ? (
            <div id="ticket-details">
              <TicketEditor
                ticket={ticket}
                onChange={setTicket}
                expanded={detailsOpen}
              />
              {detailsOpen && trace && <TracePanel trace={trace} />}
            </div>
          ) : (
            <div className={styles.empty}>
              <svg
                viewBox="0 0 24 24"
                width={32}
                height={32}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />
              </svg>
              <p>Your ticket will appear here once you create it.</p>
            </div>
          )}
        </section>
      </div>
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
        repo={repo}
        onRepoChange={(value) => {
          setRepo(value);
          const ref = parseRepoInput(value);
          setMemory(ref ? loadMemory(ref.slug) : null);
        }}
        repoInvalid={!!repo && !repoRef}
        repoNote={
          memory
            ? `Remembered ${memory.paths.length} files, ${
                memory.chunks.length
              } chunks. Stack: ${
                memory.profile?.stack.join(", ") || "unknown"
              }.`
            : repoRef
              ? `Will read ${repoRef.slug}.`
              : ""
        }
        ghToken={ghToken}
        onGhTokenChange={setGhToken}
        indexLabel={memory ? "Re-index" : "Index repo"}
        canIndex={!!repoRef && !!model && !status}
        onIndex={index}
        status={status}
      />
    </main>
  );
}
