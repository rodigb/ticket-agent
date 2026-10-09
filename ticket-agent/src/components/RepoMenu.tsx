import { useEffect, useRef, useState } from "react";
import { useTheme } from "../ThemeProvider";

const MOON = "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z";
const SUN =
  "M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z";

const styles = {
  wrap: "relative",
  cog: "rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  panel:
    "absolute right-0 z-10 mt-2 w-80 rounded-xl border border-line bg-surface p-4 text-left shadow-xl",
  title: "text-sm font-semibold text-body",
  hint: "mt-1 text-xs text-muted",
  row: "mt-3 flex gap-2",
  input:
    "min-w-0 flex-1 rounded-md border border-line bg-transparent px-3 py-2 text-sm text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  button:
    "rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  error: "mt-2 text-xs text-red-700 dark:text-red-400",
  appearance:
    "mt-4 flex items-center justify-between border-t border-line pt-4",
  themeButton:
    "rounded-full border border-line p-2 text-body transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
};

interface Props {
  onImport: (input: string) => string | null; // returns an error message, or null on success
}

// Cog in the top corner; its dropdown lets the user import a repo as a homescreen placeholder.
export function RepoMenu({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const { mode, setMode } = useTheme();

  const isDark = mode === "dark";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = onImport(value);
    setError(err ?? "");
    if (!err) {
      setValue("");
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.cog}
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
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

      {open && (
        <form className={styles.panel} onSubmit={submit}>
          <h2 className={styles.title}>Import your repo</h2>
          <p className={styles.hint}>
            Adds a placeholder to the homescreen. Removing it later does not
            delete the repo.
          </p>
          <div className={styles.row}>
            <input
              className={styles.input}
              aria-label="GitHub URL or owner/repo"
              placeholder="GitHub URL or owner/repo"
              value={value}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
            />
            <button type="submit" className={styles.button}>
              Import
            </button>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.appearance}>
            <span className={styles.title}>Dark mode</span>
            <button
              type="button"
              className={styles.themeButton}
              aria-label="Dark mode"
              aria-pressed={isDark}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setMode(isDark ? "light" : "dark")}
            >
              <svg
                viewBox="0 0 24 24"
                width={20}
                height={20}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={isDark ? SUN : MOON} />
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
