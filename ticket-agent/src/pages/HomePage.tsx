import { FeatureCard, type FeatureCardProps } from "../components/FeatureCard";
import { RepoMenu } from "../components/RepoMenu";
import { RepoPlaceholderList } from "../components/RepoPlaceholderList";
import { useRepoPlaceholders } from "../repo/placeholders";
import { ROUTES } from "../routes";

const CONTAINER_CLASS = "flex gap-4 flex-row w-full";

const CARDS: FeatureCardProps[] = [
  {
    title: "Ticket creation",
    description:
      "Describe the work and get a ticket with acceptance criteria that fits your codebase.",
    to: ROUTES.tickets,
  },
  {
    title: "Development",
    description: "Turn a ticket into code changes in your repository.",
  },
  {
    title: "Development review",
    description:
      "Check finished work against the ticket's acceptance criteria.",
  },
];

export default function HomePage() {
  const { slugs, add, remove } = useRepoPlaceholders();

  return (
    <main>
      <div className="flex items-start justify-between">
        <div>
          <h1>AI workflow</h1>
          <p>From requirement to reviewed code.</p>
        </div>
        <RepoMenu onImport={add} />
      </div>

      <div className={CONTAINER_CLASS}>
        {CARDS.map((card) => (
          <FeatureCard key={card.title} {...card} />
        ))}
      </div>

      <RepoPlaceholderList slugs={slugs} onRemove={remove} />
    </main>
  );
}
