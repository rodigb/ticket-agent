import { useEffect, useRef } from "react";
import { PROVIDERS } from "../llm/providers";
import type { ProviderId } from "../types";

const styles = {
  // m-auto: Tailwind's reset removes the browser's default centring of <dialog>.
  dialog:
    "m-auto w-full max-w-md rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100",
  body: "p-6",
  header: "mb-4 flex items-center justify-between",
  title: "text-lg font-semibold",
  closeIcon:
    "rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
  label: "mt-4 mb-1 block text-sm font-medium",
  control:
    "w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-slate-700",
  hint: "mt-1 text-sm text-slate-500 dark:text-slate-400",
  error: "mt-3 text-sm text-red-700 dark:text-red-400",
  actions: "mt-6 flex items-center justify-between gap-2",
  secondaryButton:
    "rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
  primaryButton:
    "rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
};

interface Props {
  open: boolean;
  onClose: () => void;
  provider: ProviderId;
  onProviderChange: (p: ProviderId) => void;
  model: string;
  models: string[];
  onModelChange: (m: string) => void;
  apiKey: string;
  onApiKeyChange: (k: string) => void;
  modelsError: string;
  onRefreshModels: () => void;
}

export function SettingsModal(p: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  // The native dialog owns focus trapping and Esc; we only sync its open state with ours.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) d.showModal();
    if (!p.open && d.open) d.close();
  }, [p.open]);

  const info = PROVIDERS[p.provider];

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="settings-title"
      onClose={p.onClose}
      // Clicks on the backdrop land on the dialog itself; the padded inner div keeps content clicks out.
      onClick={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div className={styles.body}>
        <div className={styles.header}>
          <h2 id="settings-title" className={styles.title}>
            Settings
          </h2>
          <button
            type="button"
            className={styles.closeIcon}
            aria-label="Close settings"
            onClick={p.onClose}
          >
            ✕
          </button>
        </div>

        <label className={styles.label} htmlFor="settings-provider">
          Provider
        </label>
        <select
          id="settings-provider"
          className={styles.control}
          value={p.provider}
          onChange={(e) => p.onProviderChange(e.target.value as ProviderId)}
        >
          {Object.entries(PROVIDERS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <label className={styles.label} htmlFor="settings-model">
          Model
        </label>
        <select
          id="settings-model"
          className={styles.control}
          value={p.model}
          disabled={p.models.length === 0}
          onChange={(e) => p.onModelChange(e.target.value)}
        >
          {p.models.length === 0 && <option value="">No models found</option>}
          {p.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {p.provider === "ollama" && (
          <p className={styles.hint}>
            Models you have pulled locally with Ollama.
          </p>
        )}
        {p.modelsError && (
          <p className={styles.error} role="alert">
            {p.modelsError}
          </p>
        )}

        {info.needsKey && (
          <>
            <label className={styles.label} htmlFor="settings-key">
              API key
            </label>
            <input
              id="settings-key"
              type="password"
              autoComplete="off"
              className={styles.control}
              value={p.apiKey}
              onChange={(e) => p.onApiKeyChange(e.target.value)}
            />
            <p className={styles.hint}>
              Kept in this tab's memory only. It is not saved, and is sent
              straight to the provider.
            </p>
          </>
        )}

        <div className={styles.actions}>
          {p.provider === "ollama" ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={p.onRefreshModels}
            >
              Refresh models
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={p.onClose}
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
