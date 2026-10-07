import classNames from "classnames";
import { Link } from "react-router-dom";

export interface FeatureCardProps {
  title: string;
  description: string;
  to?: string; // no destination means the feature is not built yet
}

const cardClass = classNames(
  "group relative isolate flex h-full min-w-0 flex-col sm:flex-1 overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-300",
);

function CardContent({
  title,
  description,
  footer,
}: {
  title: string;
  description: string;
  footer: string;
}) {
  return (
    <>
      <h2>{title}</h2>
      <p>{description}</p>
      <p>{footer}</p>
    </>
  );
}

export function FeatureCard({ title, description, to }: FeatureCardProps) {
  if (!to) {
    // Not a link: keyboard users should not tab to something that does nothing.
    return (
      <div className={cardClass}>
        <CardContent
          title={title}
          description={description}
          footer="Coming soon"
        />
      </div>
    );
  }

  return (
    <Link to={to} className={cardClass}>
      <CardContent title={title} description={description} footer="Open" />
    </Link>
  );
}
