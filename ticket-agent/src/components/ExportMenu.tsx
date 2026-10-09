import { useEffect, useRef, useState } from "react";

const styles = {
  wrap: "relative",
  trigger:
    "inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40",
  menu: "absolute right-0 z-10 mt-2 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-surface py-1 text-left shadow-xl",
  item: "block w-full px-4 py-2 text-left text-sm text-body hover:bg-background focus-visible:bg-background focus-visible:outline-none",
  hint: "block text-xs text-muted",
};

export interface ExportOption {
  label: string;
  hint: string;
  onSelect: () => void;
}

// One button that reveals the export targets, aligned to the right edge of the results header.
export function ExportMenu({
  options,
  disabled = false,
}: {
  options: ExportOption[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        Export
        <svg
          viewBox="0 0 20 20"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {open && !disabled && (
        <div className={styles.menu} role="menu">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                o.onSelect();
                setOpen(false);
              }}
            >
              {o.label}
              <span className={styles.hint}>{o.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
