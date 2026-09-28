import { config } from "../../package.json";
import {
  combineResults,
  extractFailureDetails,
  failureResult,
  NO_QUERY,
  recordResult,
  type LookupResult,
} from "./lookupResult";
import type { ParsedReference } from "./referenceParser";
import { stripXmlTags } from "./textUtils";

// No `mailto` politeness param here on purpose - that would mean putting the
// user's email in a URL sent to a third-party service without them having
// asked for it. Works fine without it, just outside Crossref's "polite pool".
const REQUEST_TIMEOUT_MS = 8000;

export async function fetchCrossrefAbstract(
  parsed: ParsedReference,
): Promise<LookupResult> {
  let byDoi = NO_QUERY;
  if (parsed.doi) {
    byDoi = await fetchByDOI(parsed.doi);
    if (byDoi.kind === "found") return byDoi;
  }
  // Without a parsed title (a citation style referenceParser doesn't
  // recognize), fall back to the whole reference string: Crossref's
  // query.bibliographic is designed to match free-form citation text.
  const query = parsed.title ?? stripLeadingMarker(parsed.raw);
  if (query) {
    return combineResults(
      byDoi,
      await fetchByBibliographicQuery(
        query,
        parsed.title ? parsed.authors : undefined,
      ),
    );
  }
  return byDoi;
}

export function stripLeadingMarker(raw: string): string {
  return raw.replace(/^\[\d+\]\s*/, "").trim();
}

export function buildDoiUrl(doi: string): string {
  return `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
}

export function buildBibliographicQueryUrl(
  title: string,
  authors: string | undefined,
): string {
  const query = [title, authors].filter(Boolean).join(" ");
  return `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=1`;
}

async function fetchByDOI(doi: string): Promise<LookupResult> {
  return requestAbstract(buildDoiUrl(doi), (data) =>
    recordResult(!!data?.message, stripXmlTags(data?.message?.abstract)),
  );
}

async function fetchByBibliographicQuery(
  title: string,
  authors: string | undefined,
): Promise<LookupResult> {
  return requestAbstract(buildBibliographicQueryUrl(title, authors), (data) => {
    const top = data?.message?.items?.[0];
    return recordResult(!!top, stripXmlTags(top?.abstract));
  });
}

async function requestAbstract(
  url: string,
  toResult: (data: any) => LookupResult,
): Promise<LookupResult> {
  try {
    const xhr = await Zotero.HTTP.request("GET", url, {
      responseType: "json",
      timeout: REQUEST_TIMEOUT_MS,
      // See semanticScholar.ts - disable Zotero.HTTP.request's own built-in
      // retry-on-error so behavior here stays simple and predictable (a
      // single request, single catch), consistent across both providers.
      errorDelayMax: 0,
    });
    return toResult(xhr.response);
  } catch (e: any) {
    // Network failure, timeout, or non-2xx (e.g. 404 = no such DOI).
    ztoolkit.log(`[${config.addonRef}] Crossref request failed for ${url}:`, e);
    return failureResult(extractFailureDetails(e));
  }
}
