// Outcome of one external source's abstract lookup. Keeping "the work
// genuinely has no abstract there" (missing) separate from "we couldn't find
// out" (error) is what lets the orchestrator cache only confirmed misses;
// the finer detail on each is what the popup shows the user (see
// lookupReport.ts), so they can tell a publisher that doesn't share
// abstracts apart from a rejected API key or a rate limit.
export type LookupResult =
  | { kind: "found"; abstract: string }
  | { kind: "missing"; detail: MissingDetail }
  | { kind: "error"; failure: HttpFailure };

/**
 * noMatch = no record for this DOI/title; noAbstract = record found but it
 * has no abstract (common - many publishers don't share them); noQuery = no
 * DOI or title could be extracted to search with, so nothing was sent.
 */
export type MissingDetail = "noMatch" | "noAbstract" | "noQuery";

/**
 * auth = API key rejected (401/403); rateLimited = 429 (after any retries);
 * server = 5xx or any other unexpected status; network = no HTTP response at
 * all (offline, DNS, timeout).
 */
export type FailureReason = "auth" | "rateLimited" | "server" | "network";

export interface HttpFailure {
  reason: FailureReason;
  status?: number;
  statusText?: string;
  /** The service's own error text (e.g. from a JSON `message` field), or an exception message. */
  message?: string;
}

export const NO_MATCH: LookupResult = { kind: "missing", detail: "noMatch" };
export const NO_ABSTRACT: LookupResult = {
  kind: "missing",
  detail: "noAbstract",
};
export const NO_QUERY: LookupResult = { kind: "missing", detail: "noQuery" };

/**
 * Classify a failed HTTP request. 404 (no such DOI) and 400 (query the API
 * won't accept) are definitive answers - retrying won't change them - so they
 * count as a miss. `undefined`/0 means no HTTP response at all.
 */
export function classifyFailure(
  status: number | undefined,
): "missing" | FailureReason {
  if (status === 404 || status === 400) return "missing";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rateLimited";
  if (!status) return "network";
  return "server";
}

/** Turn a caught request failure into a LookupResult (a miss or an error). */
export function failureResult(failure: {
  status?: number;
  statusText?: string;
  message?: string;
}): LookupResult {
  const reason = classifyFailure(failure.status);
  if (reason === "missing") return NO_MATCH;
  return { kind: "error", failure: { reason, ...failure } };
}

// Most to least useful to report when merging attempts (see below).
const PRIORITY: ((r: LookupResult) => boolean)[] = [
  (r) => r.kind === "found",
  (r) => r.kind === "error" && r.failure.reason === "auth",
  (r) => r.kind === "error",
  (r) => r.kind === "missing" && r.detail === "noAbstract",
  (r) => r.kind === "missing" && r.detail === "noMatch",
];

/**
 * Merge several attempts at the same lookup (e.g. by DOI then by title) into
 * one outcome: any hit wins; then an auth error (actionable by the user);
 * then any other error (transient, so worth retrying rather than caching);
 * then "a record exists but has no abstract" over "no record at all".
 */
export function combineResults(...results: LookupResult[]): LookupResult {
  for (const matches of PRIORITY) {
    const best = results.find(matches);
    if (best) return best;
  }
  return results[0] ?? NO_QUERY;
}

/** A successful response: did the matched record actually carry an abstract? */
export function recordResult(
  recordFound: boolean,
  abstract: string | undefined,
): LookupResult {
  if (abstract) return { kind: "found", abstract };
  return recordFound ? NO_ABSTRACT : NO_MATCH;
}

export function isError(result: LookupResult | undefined): boolean {
  return result?.kind === "error";
}

/**
 * Pull what's worth showing out of a `Zotero.HTTP.request` rejection. Its
 * exact shape isn't in zotero-types, so this probes defensively: the status
 * sits on the error or its underlying XHR; a JSON error body (Semantic
 * Scholar sends `{"message": ...}`) is on `xmlhttp.response`. The exception's
 * own message is only used when there was no HTTP response at all (timeout,
 * offline) - otherwise it's a verbose "HTTP request to <url> rejected..."
 * that repeats the status and leaks the full URL into the popup.
 */
export function extractFailureDetails(e: any): {
  status?: number;
  statusText?: string;
  message?: string;
} {
  const xhr = e?.xmlhttp;
  const status: number | undefined = e?.status ?? xhr?.status;
  const bodyMessage = xhr?.response?.message;
  const message =
    typeof bodyMessage === "string"
      ? bodyMessage
      : !status && e?.message
        ? String(e.message)
        : undefined;
  return {
    status: status || undefined,
    statusText: xhr?.statusText || undefined,
    message,
  };
}
