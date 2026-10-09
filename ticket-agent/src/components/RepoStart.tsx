import { useState } from "react";
import { parseRepoInput } from "../repo/parseRepo";
import { useRepoSummary } from "../repo/useRepoSummary";
import { RepoSummary } from "./RepoSummary";

const INVALID_MSG =
  "Enter a GitHub URL such as https://github.com/owner/repo, or owner/repo.";
const EMPTY_MSG =
  "Enter a repository URL first. Accurate tickets cannot be created without repo context.";
const NO_REPO_MSG =
  "Accurate, ideal tickets cannot be created without repo context. Enter a repository URL to continue.";

const styles = {
  panel:
    "mx-auto w-full max-w-2xl rounded-2xl border border-line bg-surface p-5 text-left shadow-sm sm:p-6",
  title: "m-0! text-lg! leading-normal! font-semibold! tracking-normal!",
  hint: "mt-1 mb-4 text-sm text-muted",
  input:
    "w-full rounded-lg border border-line bg-background px-3 py-2.5 text-body placeholder:text-muted/70 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/40",
  actions: "mt-4 flex flex-col gap-2 sm:flex-row",
  primary:
    "inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  secondary:
    "inline-flex items-center justify-center rounded-lg border border-line px-4 py-2.5 font-medium transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  error:
    "mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  note: "mt-3 text-sm text-muted",
};

interface Props {
  onContinue: (slug: string) => void;
}

// Asks for a repo URL, previews the repo once GitHub answers, and gates entry to ticket creation.
export function RepoStart({ onContinue }: Props) {
  const [input, setInput] = useState("");
  const [actionError, setActionError] = useState("");

  const ref = parseRepoInput(input);
  const slug = ref?.slug ?? null;
  const invalid = input.trim() !== "" && !ref;
  const summary = useRepoSummary(slug);
  const { info, loading, error: loadError } = summary;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return setActionError(EMPTY_MSG);
    if (!ref) return setActionError(INVALID_MSG);
    if (loading)
      return setActionError(
        "Still loading repo information. Try again in a moment.",
      );
    if (!info)
      return setActionError(
        loadError || "Repo information could not be loaded.",
      );
    setActionError("");
    onContinue(ref.slug);
  };

  const withoutRepo = () =>
    setActionError(input.trim() ? NO_REPO_MSG : EMPTY_MSG);

  const error = invalid ? INVALID_MSG : loadError || actionError;

  return (
    <form className={styles.panel} onSubmit={submit} noValidate>
      <h2 className={styles.title}>Start with a repository</h2>
      <p className={styles.hint}>
        Tickets are grounded in your code. Enter the repo you want to write for.
      </p>

      <label className="sr-only" htmlFor="repo-url">
        Repository URL
      </label>
      <input
        id="repo-url"
        className={styles.input}
        placeholder="GitHub URL or owner/repo"
        value={input}
        aria-invalid={!!error}
        onChange={(e) => {
          setInput(e.target.value);
          setActionError("");
        }}
      />

      {loading && (
        <p className={styles.note} role="status">
          Loading repo information…
        </p>
      )}

      <RepoSummary summary={summary} className="mt-4" />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary}>
          Continue to Ticket Creation
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={withoutRepo}
        >
          Continue without Repo
        </button>
      </div>
    </form>
  );
}
