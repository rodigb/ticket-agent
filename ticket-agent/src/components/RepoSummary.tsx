import {
  classifyRepoSize,
  formatRepoSize,
  rateDigestibility,
  type DigestLevel,
  type RepoDigest,
  type RepoSizeLevel,
} from "../repo/repo";
import type { RepoSummaryState } from "../repo/useRepoSummary";

type Tone = { text: string; dot: string };
const GREEN: Tone = {
  text: "text-green-700 dark:text-green-400",
  dot: "bg-green-600 dark:bg-green-400",
};
const YELLOW: Tone = {
  text: "text-yellow-700 dark:text-yellow-400",
  dot: "bg-yellow-500 dark:bg-yellow-400",
};
const RED: Tone = {
  text: "text-red-700 dark:text-red-400",
  dot: "bg-red-600 dark:bg-red-400",
};

const SIZE_TONE: Record<RepoSizeLevel, Tone & { label: string }> = {
  small: { ...GREEN, label: "small" },
  medium: { ...YELLOW, label: "medium" },
  large: { ...RED, label: "large" },
};

const DIGEST_TONE: Record<DigestLevel, Tone & { label: string }> = {
  easy: { ...GREEN, label: "Easy to digest" },
  moderate: { ...YELLOW, label: "Partly covered" },
  hard: { ...RED, label: "Hard to digest" },
};

function digestDetail(d: RepoDigest): string {
  if (d.readableFiles === 0) return "No readable source files were found.";
  if (d.truncated)
    return "The repo is so large that GitHub returned only part of its file list.";
  const pct = Math.round((d.indexedFiles / d.readableFiles) * 100);
  return `The agent can read ${d.indexedFiles} of ${d.readableFiles} usable files (${pct}%). Binary and oversized files are skipped.`;
}

function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      className={`mr-1.5 inline-block size-2 rounded-full ${tone.dot}`}
      aria-hidden="true"
    />
  );
}

const styles = {
  card: "rounded-lg border border-line bg-background p-4 text-left",
  name: "font-semibold text-body",
  desc: "mt-1 text-sm text-muted",
  stats: "mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4",
  label: "block text-xs uppercase tracking-wide text-muted",
  readiness: "mt-4 border-t border-line pt-3 text-sm",
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// The repo details card shared by the home screen and the ticket page.
export function RepoSummary({
  summary,
  className = "",
}: {
  summary: RepoSummaryState;
  className?: string;
}) {
  const { info, digest, digestLoading, digestFailed } = summary;
  if (!info) return null;

  const size = SIZE_TONE[classifyRepoSize(info.sizeKb)];

  return (
    <div className={`${styles.card} ${className}`}>
      <p className={styles.name}>{info.fullName}</p>
      <p className={styles.desc}>
        {info.description || "No description provided."}
      </p>
      <dl className={styles.stats}>
        <div>
          <dt className={styles.label}>Language</dt>
          <dd>{info.language ?? "Unknown"}</dd>
        </div>
        <div>
          <dt className={styles.label}>Stars</dt>
          <dd>{info.stars.toLocaleString()}</dd>
        </div>
        <div>
          <dt className={styles.label}>Size</dt>
          <dd>
            <span className={`font-medium ${size.text}`}>
              <Dot tone={size} />
              {formatRepoSize(info.sizeKb)} ({size.label})
            </span>
          </dd>
        </div>
        <div>
          <dt className={styles.label}>Last push</dt>
          <dd>{dateFormat.format(new Date(info.pushedAt))}</dd>
        </div>
      </dl>

      <div className={styles.readiness}>
        <span className={styles.label}>Agent readiness</span>
        {digestLoading && (
          <p className="mt-1 text-muted" role="status">
            Checking how easy this repo is to digest…
          </p>
        )}
        {digestFailed && (
          <p className="mt-1 text-muted">
            Could not check how easy this repo is to digest.
          </p>
        )}
        {digest && (
          <>
            <p
              className={`mt-1 font-semibold ${
                DIGEST_TONE[rateDigestibility(digest)].text
              }`}
            >
              <Dot tone={DIGEST_TONE[rateDigestibility(digest)]} />
              {DIGEST_TONE[rateDigestibility(digest)].label}
            </p>
            <p className="mt-1 text-muted">{digestDetail(digest)}</p>
          </>
        )}
      </div>
    </div>
  );
}
