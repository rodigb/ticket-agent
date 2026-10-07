const styles = {
  section: "mt-10",
  title: "mb-3 text-sm font-semibold uppercase tracking-wide text-muted",
  list: "flex flex-wrap gap-3",
  item: "flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface/50 py-2 pr-2 pl-4 text-sm text-body",
  badge:
    "rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent",
  remove:
    "rounded-md px-2 py-1 text-muted hover:bg-surface hover:text-red-700 focus-visible:outline-2 focus-visible:outline-accent dark:hover:text-red-400",
};

interface Props {
  slugs: string[];
  onRemove: (slug: string) => void;
}

export function RepoPlaceholderList({ slugs, onRemove }: Props) {
  if (slugs.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Your repos</h2>
      <ul className={styles.list}>
        {slugs.map((slug) => (
          <li key={slug} className={styles.item}>
            <span>{slug}</span>
            <span className={styles.badge}>Placeholder</span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove placeholder for ${slug}`}
              onClick={() => onRemove(slug)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
