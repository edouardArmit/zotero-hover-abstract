import type { ParsedReference } from "./referenceParser";

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

async function fetchByDOI(doi: string): Promise<string | undefined> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const message = await requestJSON(url);
  return extractPlainText(message?.message?.abstract);
}

async function fetchByBibliographicQuery(
  title: string,
  authors: string | undefined,
): Promise<string | undefined> {
  const query = [title, authors].filter(Boolean).join(" ");
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=1`;
  const message = await requestJSON(url);
  return extractPlainText(message?.message?.items?.[0]?.abstract);
}

async function requestJSON(url: string): Promise<any | undefined> {
  try {
    const xhr = await Zotero.HTTP.request("GET", url, {
      responseType: "json",
      timeout: REQUEST_TIMEOUT_MS,
    });
    return xhr.response;
  } catch {
    // Network failure, timeout, or non-2xx (e.g. no match for a DOI lookup) -
    // all just mean "no abstract available this way", not an error to surface.
    return undefined;
  }
}

// Crossref abstracts are JATS-XML fragments (e.g. "<jats:p>...</jats:p>") -
// strip tags down to plain text for display.
function extractPlainText(jatsXml: string | undefined): string | undefined {
  if (!jatsXml) return undefined;
  const text = jatsXml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}
