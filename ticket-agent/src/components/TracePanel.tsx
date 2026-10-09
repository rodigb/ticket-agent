import type { TraceInfo } from "../types";

const styles = {
  panel: "mt-6 rounded-lg border border-line bg-background px-4 py-3 text-sm",
  summary: "cursor-pointer text-muted hover:text-body",
  text: "mt-2",
  list: "mt-1 ml-5 list-disc",
  code: "text-xs",
};

// Shows what the model was given for this ticket, so a bad ticket can be traced to its input.
export function TracePanel({ trace }: { trace: TraceInfo }) {
  const files = [...new Set(trace.chunkPaths)];
  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        How this ticket was made: {trace.seconds.toFixed(1)}s,{" "}
        {trace.attempts === 1
          ? "valid on the first try"
          : `needed ${trace.attempts} attempts`}
      </summary>
      <p className={styles.text}>
        Skills used:{" "}
        {trace.skillNames.length ? trace.skillNames.join(", ") : "none"}
      </p>
      <p className={styles.text}>
        Code the model was shown ({files.length} file
        {files.length === 1 ? "" : "s"}):
      </p>
      {files.length ? (
        <ul className={styles.list}>
          {files.map((f) => (
            <li key={f}>
              <code className={styles.code}>{f}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.text}>
          No repository indexed, so the ticket is not grounded in code.
        </p>
      )}
    </details>
  );
}
