import { useEffect, useState } from "react";
import {
  fetchRepoDigest,
  fetchRepoInfo,
  type RepoDigest,
  type RepoInfo,
} from "./repo";

export interface RepoSummaryState {
  info: RepoInfo | null;
  loading: boolean;
  error: string;
  digest: RepoDigest | null;
  digestLoading: boolean;
  digestFailed: boolean;
}

const EMPTY: RepoSummaryState = {
  info: null,
  loading: false,
  error: "",
  digest: null,
  digestLoading: false,
  digestFailed: false,
};

// Loads the repo's public details and how much of it the agent can read. Pass null to clear.
export function useRepoSummary(
  slug: string | null,
  token = ""
): RepoSummaryState {
  const [state, setState] = useState<RepoSummaryState>(EMPTY);

  useEffect(() => {
    setState(EMPTY);
    if (!slug) return;
    const ctrl = new AbortController();
    const patch = (p: Partial<RepoSummaryState>) => {
      if (!ctrl.signal.aborted) setState((s) => ({ ...s, ...p }));
    };
    // Debounced so typing a URL does not call GitHub on every keystroke.
    const timer = setTimeout(async () => {
      patch({ loading: true });
      try {
        const info = await fetchRepoInfo(slug, ctrl.signal, token);
        patch({ info, loading: false, digestLoading: true });
        // The readiness check is extra detail, so a failure here does not block anything.
        try {
          const digest = await fetchRepoDigest(
            slug,
            info.defaultBranch,
            ctrl.signal,
            token
          );
          patch({ digest, digestLoading: false });
        } catch {
          patch({ digestFailed: true, digestLoading: false });
        }
      } catch (e) {
        patch({
          error: e instanceof Error ? e.message : String(e),
          loading: false,
        });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [slug, token]);

  return state;
}
