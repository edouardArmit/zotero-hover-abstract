import { config } from "../../package.json";
import { getPref } from "../utils/prefs";
import type { ParsedReference } from "./referenceParser";

// Tried as a secondary fallback after Crossref: Crossref abstract coverage is
// inconsistent (many publishers, notably ACM, don't deposit abstracts at
// all), while Semantic Scholar aggregates from more sources and has notably
// better coverage for CS venues specifically. No API key needed for this
// unauthenticated, low-volume use, though it's more tightly rate-limited
// than Crossref's public pool - real-world testing showed 429s aren't rare,
// so requests here retry with exponential backoff on 429/5xx per Semantic
// Scholar's own recommended practice, instead of giving up on the first hit.
const REQUEST_TIMEOUT_MS = 8000;
const BASE_URL = "https://api.semanticscholar.org/graph/v1/paper";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export async function fetchSemanticScholarAbstract(
  parsed: ParsedReference,
): Promise<string | undefined> {
  if (parsed.doi) {
    const byDoi = await fetchByDOI(parsed.doi);
    if (byDoi) return byDoi;
  }
  if (parsed.title) {
    return fetchByTitleSearch(parsed.title);
  }
  return undefined;
}

async function fetchByDOI(doi: string): Promise<string | undefined> {
  const url = `${BASE_URL}/DOI:${encodeURIComponent(doi)}?fields=abstract`;
  const data = await requestJSON(url);
  return normalize(data?.abstract);
}

async function fetchByTitleSearch(title: string): Promise<string | undefined> {
  const url = `${BASE_URL}/search?query=${encodeURIComponent(title)}&fields=title,abstract&limit=1`;
  const data = await requestJSON(url);
  return normalize(data?.data?.[0]?.abstract);
}

async function requestJSON(url: string): Promise<any | undefined> {
  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const xhr = await Zotero.HTTP.request("GET", url, {
        responseType: "json",
        timeout: REQUEST_TIMEOUT_MS,
        // Zotero.HTTP.request has its own built-in retry-with-backoff for
        // failed requests; disable it so our own explicit retry loop below
        // is the only one running - otherwise the two stack, multiplying
        // actual requests sent and muddying what's actually happening.
        errorDelayMax: 0,
        headers: apiKeyHeaders(),
      });
      return xhr.response;
    } catch (e) {
      const status = getStatus(e);
      const isThrottled = status === 429 || (status ?? 0) >= 500;
      const attemptsLeft = attempt < MAX_RETRIES;

      if (!isThrottled || !attemptsLeft) {
        logRequestFailure(url, e, attempt);
        return undefined;
      }

      ztoolkit.log(
        `[${config.addonRef}] Semantic Scholar throttled (status ${status}), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await delay(Math.min(backoffMs, MAX_BACKOFF_MS));
      backoffMs *= 2;
    }
  }
  return undefined;
}

function apiKeyHeaders(): Record<string, string> | undefined {
  const apiKey = getPref("semanticScholarApiKey");
  return apiKey ? { "x-api-key": apiKey } : undefined;
}

function getStatus(e: any): number | undefined {
  return e?.status ?? e?.xmlhttp?.status;
}

// zotero-types doesn't declare Bluebird's static `.delay`, though it exists
// at runtime (the scaffold's own template code uses this same call) - the
// standard `Promise` this scope has access to has no delay/sleep helper of
// its own, and `setTimeout` isn't reliably available in this privileged
// bootstrap scope (see popupObserver.ts's MutationObserver note).
function delay(ms: number): Promise<void> {
  return (Zotero.Promise as any).delay(ms);
}

// Diagnostic logging - investigating how often/why we're hit with 429s (see
// project notes: possibly per-IP throttling shared across a whole university
// network's NAT'd egress, not our own request volume). `e`'s exact shape
// isn't in zotero-types, so this probes defensively for whatever Zotero's
// HTTP module actually attaches (status, the underlying XHR for response
// headers like Retry-After) rather than assuming a fixed structure.
function logRequestFailure(url: string, e: any, attempt: number): void {
  const xhr: XMLHttpRequest | undefined = e?.xmlhttp;
  ztoolkit.log(`[${config.addonRef}] Semantic Scholar request failed:`, {
    url,
    attempt,
    status: e?.status ?? xhr?.status,
    retryAfter: xhr?.getResponseHeader?.("Retry-After"),
    allResponseHeaders: xhr?.getAllResponseHeaders?.(),
    message: e?.message ?? String(e),
  });
}

function normalize(text: string | null | undefined): string | undefined {
  return text?.trim() || undefined;
}
