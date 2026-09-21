import type { ParsedReference } from "./referenceParser";

// In-memory only (cleared on plugin reload/restart) - avoids re-searching the
// local library or re-hitting Crossref every time the same citation is
// re-hovered within a session. `null` means "looked it up, found nothing",
// which is itself worth caching so we don't keep retrying a miss.
const cache = new Map<string, string | null>();

function cacheKey(parsed: ParsedReference): string {
  return parsed.doi ?? parsed.raw;
}

/** undefined = not looked up yet; null = looked up, no abstract found. */
export function getCachedAbstract(
  parsed: ParsedReference,
): string | null | undefined {
  return cache.get(cacheKey(parsed));
}

export function setCachedAbstract(
  parsed: ParsedReference,
  abstractText: string | null,
): void {
  cache.set(cacheKey(parsed), abstractText);
}
