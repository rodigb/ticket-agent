import type { Ticket, TicketListKey } from "../types";

const styles = {
  header: "mb-2 flex items-center gap-2 text-sm text-muted",
  badge:
    "grid size-5 place-items-center rounded-sm text-xs font-bold text-white",
  titleInput:
    "w-full rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 text-xl font-semibold text-body @md:text-2xl hover:border-line focus-visible:border-accent focus-visible:outline-none",
  layout: "mt-6 grid gap-6 @xl:grid-cols-[minmax(0,1fr)_14rem]",
  details:
    "h-fit rounded-md border border-line bg-background p-4 @xl:order-last",
  detailsTitle: "mb-3 text-sm font-semibold text-body",
  metaField:
    "mb-3 flex flex-col gap-1 text-xs uppercase tracking-wide text-muted",
  control:
    "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  sectionTitle: "mt-5 mb-2 text-sm font-semibold text-body first:mt-0",
  item: "mb-2 flex items-start gap-2",
  itemInput: "flex-1",
  removeButton:
    "rounded-md border border-line px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950",
  addButton:
    "rounded-md border border-line px-3 py-1.5 text-sm text-accent hover:bg-surface",
  srOnly: "sr-only",
};

const TYPE_COLOR: Record<Ticket["type"], string> = {
  story: "bg-green-600",
  bug: "bg-red-600",
  task: "bg-blue-600",
};

const SECTIONS: [string, TicketListKey][] = [
  ["Acceptance criteria", "acceptanceCriteria"],
  ["Tasks", "tasks"],
  ["Affected files", "affectedFiles"],
  ["New files", "newFiles"],
  ["Risks", "risks"],
  ["Open questions", "openQuestions"],
];

interface Props {
  ticket: Ticket;
  onChange: (t: Ticket) => void;
  expanded?: boolean; // collapsed shows only title, description and acceptance criteria
}

// Every field of the generated ticket is editable, because the model's draft is a starting point.
export function TicketEditor({ ticket, onChange, expanded = true }: Props) {
  const set = <K extends keyof Ticket>(key: K, value: Ticket[K]) =>
    onChange({ ...ticket, [key]: value });
  const setItem = (key: TicketListKey, i: number, value: string) =>
    set(
      key,
      ticket[key].map((x, j) => (j === i ? value : x)),
    );
  const removeItem = (key: TicketListKey, i: number) =>
    set(
      key,
      ticket[key].filter((_, j) => j !== i),
    );
  const addItem = (key: TicketListKey) => set(key, [...ticket[key], ""]);

  return (
    <div className="@container">
      {expanded && (
        <div className={styles.header}>
          <span
            className={`${styles.badge} ${TYPE_COLOR[ticket.type]}`}
            aria-hidden="true"
          >
            {ticket.type[0].toUpperCase()}
          </span>
          <span className="capitalize">{ticket.type}</span>
        </div>
      )}

      <label className={styles.srOnly} htmlFor="ticket-title">
        Title
      </label>
      <input
        id="ticket-title"
        className={styles.titleInput}
        value={ticket.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <div className={expanded ? styles.layout : "mt-6"}>
        <div>
          <h3 className={styles.sectionTitle}>Description</h3>
          <label className={styles.srOnly} htmlFor="ticket-description">
            Description
          </label>
          <textarea
            id="ticket-description"
            rows={4}
            className={styles.control}
            value={ticket.description}
            onChange={(e) => set("description", e.target.value)}
          />

          {SECTIONS.filter(
            ([, key]) => expanded || key === "acceptanceCriteria",
          ).map(([label, key]) => (
            <section key={key}>
              <h3 className={styles.sectionTitle}>{label}</h3>
              {ticket[key].map((text, i) => (
                <div className={styles.item} key={i}>
                  <textarea
                    rows={
                      key === "acceptanceCriteria" || key === "risks" ? 2 : 1
                    }
                    aria-label={`${label} ${i + 1}`}
                    className={`${styles.control} ${styles.itemInput}`}
                    value={text}
                    onChange={(e) => setItem(key, i, e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label={`Remove ${label} ${i + 1}`}
                    onClick={() => removeItem(key, i)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addButton}
                onClick={() => addItem(key)}
              >
                Add to {label.toLowerCase()}
              </button>
            </section>
          ))}
        </div>

        {expanded && (
          <aside className={styles.details} aria-label="Details">
            <h3 className={styles.detailsTitle}>Details</h3>
            <label className={styles.metaField}>
              Type
              <select
                className={styles.control}
                value={ticket.type}
                onChange={(e) => set("type", e.target.value as Ticket["type"])}
              >
                <option value="story">Story</option>
                <option value="bug">Bug</option>
                <option value="task">Task</option>
              </select>
            </label>
            <label className={styles.metaField}>
              Size
              <select
                className={styles.control}
                value={ticket.estimate}
                onChange={(e) =>
                  set("estimate", e.target.value as Ticket["estimate"])
                }
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
              </select>
            </label>
          </aside>
        )}
      </div>
    </div>
  );
}
