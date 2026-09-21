import { config } from "../../package.json";
import type { ParsedReference } from "./referenceParser";
import { stripXmlTags } from "./textUtils";

// No `mailto` politeness param here on purpose - that would mean putting the
// user's email in a URL sent to a third-party service without them having
// asked for it. Works fine without it, just outside Crossref's "polite pool".
const REQUEST_TIMEOUT_MS = 8000;

export async function fetchCrossrefAbstract(
  parsed: ParsedReference,
): Promise<string | undefined> {
  if (parsed.doi) {
    const byDoi = await fetchByDOI(parsed.doi);
    if (byDoi) return byDoi;
  }
  if (parsed.title) {
    return fetchByBibliographicQuery(parsed.title, parsed.authors);
  }
  return undefined;
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

async function fetchByDOI(doi: string): Promise<string | undefined> {
  const message = await requestJSON(buildDoiUrl(doi));
  return stripXmlTags(message?.message?.abstract);
}

async function fetchByBibliographicQuery(
  title: string,
  authors: string | undefined,
): Promise<string | undefined> {
  const message = await requestJSON(buildBibliographicQueryUrl(title, authors));
  return stripXmlTags(message?.message?.items?.[0]?.abstract);
}

async function requestJSON(url: string): Promise<any | undefined> {
  try {
    const xhr = await Zotero.HTTP.request("GET", url, {
      responseType: "json",
      timeout: REQUEST_TIMEOUT_MS,
      // See semanticScholar.ts - disable Zotero.HTTP.request's own built-in
      // retry-on-error so behavior here stays simple and predictable (a
      // single request, single catch), consistent across both providers.
      errorDelayMax: 0,
    });
    return xhr.response;
  } catch (e) {
    // Network failure, timeout, or non-2xx (e.g. no match for a DOI lookup).
    ztoolkit.log(`[${config.addonRef}] Crossref request failed for ${url}:`, e);
    return undefined;
  }
}
