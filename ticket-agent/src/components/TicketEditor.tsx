import type { Ticket, TicketListKey } from "../types";

const styles = {
  meta: "flex flex-wrap gap-3",
  metaField: "flex w-44 flex-col text-sm text-slate-500 dark:text-slate-400",
  label: "mt-3 mb-1 block text-sm text-slate-500 dark:text-slate-400",
  control:
    "w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-100",
  titleInput: "text-lg font-semibold",
  sectionTitle: "mt-5 mb-2 text-sm font-semibold",
  item: "mb-2 flex items-start gap-2",
  itemInput: "flex-1",
  removeButton:
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950",
  addButton:
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800",
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
}

// Every field of the generated ticket is editable, because the model's draft is a starting point.
export function TicketEditor({ ticket, onChange }: Props) {
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
    <div>
      <div className={styles.meta}>
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
      </div>

      <label className={styles.label} htmlFor="ticket-title">
        Title
      </label>
      <input
        id="ticket-title"
        className={`${styles.control} ${styles.titleInput}`}
        value={ticket.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <label className={styles.label} htmlFor="ticket-description">
        Description
      </label>
      <textarea
        id="ticket-description"
        rows={4}
        className={styles.control}
        value={ticket.description}
        onChange={(e) => set("description", e.target.value)}
      />

      {SECTIONS.map(([label, key]) => (
        <section key={key}>
          <h3 className={styles.sectionTitle}>{label}</h3>
          {ticket[key].map((text, i) => (
            <div className={styles.item} key={i}>
              <textarea
                rows={key === "acceptanceCriteria" || key === "risks" ? 2 : 1}
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
  );
}
