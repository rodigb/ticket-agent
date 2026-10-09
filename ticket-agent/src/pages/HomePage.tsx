import { useNavigate } from "react-router-dom";
import { RepoStart } from "../components/RepoStart";
import { ROUTES } from "../routes";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <h1>AI workflow</h1>
      <div className="w-full">
        <RepoStart
          onContinue={(repo) => navigate(ROUTES.tickets, { state: { repo } })}
        />
      </div>
    </main>
  );
}
