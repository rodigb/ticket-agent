// Cheap, objective checks on acceptance criteria. They cannot say whether a criterion is *good*,
// but they catch the usual failures: wrong format, too few or too many, no failure case,
// vague wording, and near-duplicates.

export interface CriteriaReport {
  count: number;
  countOk: boolean; // 3 to 6 items
  gwtRate: number; // share written as Given ... When ... Then ...
  hasFailureCase: boolean; // at least one criterion covers an error or edge case
  vagueRate: number; // share containing wording nobody can verify
  duplicates: number; // criteria that repeat an earlier one
}

const GWT = /\bgiven\b[\s\S]+\bwhen\b[\s\S]+\bthen\b/i;
const FAILURE =
  /\b(error|errors|invalid|fail|fails|failed|failure|cannot|can't|unable|denied|reject|rejects|rejected|missing|empty|expired|not found|timeout|timed out|unavailable|unreachable|refuses|refused|blocked|exceeds|exceeded)\b/i;
const VAGUE =
  /\b(properly|correctly|as expected|appropriate|appropriately|user[- ]friendly|seamless|seamlessly|intuitive|intuitively|etc|and so on)\b/i;

const words = (s: string): Set<string> => new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

export function checkCriteria(criteria: string[]): CriteriaReport {
  const n = criteria.length;
  const sets = criteria.map(words);
  let duplicates = 0;
  for (let i = 1; i < n; i++) {
    if (sets.slice(0, i).some((s) => jaccard(s, sets[i]) >= 0.8)) duplicates++;
  }
  return {
    count: n,
    countOk: n >= 3 && n <= 6,
    gwtRate: n ? criteria.filter((c) => GWT.test(c)).length / n : 0,
    hasFailureCase: criteria.some((c) => FAILURE.test(c)),
    vagueRate: n ? criteria.filter((c) => VAGUE.test(c)).length / n : 0,
    duplicates,
  };
}

export interface CriteriaSummary {
  gwtRate: number;
  countOkRate: number;
  failureCaseRate: number;
  vagueRate: number;
  duplicateRate: number;
}

// Average over many tickets. Returns null when there are none, so "no data" is not shown as 0%.
export function summarizeCriteria(reports: CriteriaReport[]): CriteriaSummary | null {
  if (!reports.length) return null;
  const mean = (f: (r: CriteriaReport) => number) => reports.reduce((a, r) => a + f(r), 0) / reports.length;
  return {
    gwtRate: mean((r) => r.gwtRate),
    countOkRate: mean((r) => (r.countOk ? 1 : 0)),
    failureCaseRate: mean((r) => (r.hasFailureCase ? 1 : 0)),
    vagueRate: mean((r) => r.vagueRate),
    duplicateRate: mean((r) => (r.count ? r.duplicates / r.count : 0)),
  };
}