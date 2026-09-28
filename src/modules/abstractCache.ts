import type { ExternalResults } from "./lookupReport";
import type { ParsedReference } from "./referenceParser";

// In-memory only (cleared on plugin reload/restart) - avoids re-hitting
// Crossref/Semantic Scholar every time the same citation is re-hovered.
// Stores each source's full result, so a cached miss still explains itself
// ("record found, but no abstract available") in the popup. Misses are kept
// for a shorter while than hits, since coverage on those services does
// improve over time. Results containing a lookup *error* (rate limit,
// rejected API key, network) are never cached at all - see popupObserver.ts.
// The whole cache is also cleared whenever an external-lookup pref changes
// (see hooks.ts), so e.g. fixing an API key takes effect immediately.
const FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;

export interface CachedResults {
  results: ExternalResults;
  storedAt: number;
}

const cache = new Map<string, CachedResults>();

function cacheKey(parsed: ParsedReference): string {
  return parsed.doi ?? parsed.raw;
}

function hasAbstract(results: ExternalResults): boolean {
  return (
    results.crossref.kind === "found" ||
    results.semanticScholar?.kind === "found"
  );
}

/** undefined = not looked up yet, or expired. */
export function getCachedResults(
  parsed: ParsedReference,
  now = Date.now(),
): CachedResults | undefined {
  const key = cacheKey(parsed);
  const entry = cache.get(key);
  if (!entry) return undefined;

  const ttl = hasAbstract(entry.results) ? FOUND_TTL_MS : MISS_TTL_MS;
  if (now - entry.storedAt > ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

export function setCachedResults(
  parsed: ParsedReference,
  results: ExternalResults,
  now = Date.now(),
): void {
  const key = cacheKey(parsed);
  // Re-insert so Map iteration order stays oldest-first for eviction below.
  cache.delete(key);
  cache.set(key, { results, storedAt: now });
  if (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value as string);
  }
}

export function clearAbstractCache(): void {
  cache.clear();
}
