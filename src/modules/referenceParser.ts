// Best-effort parsing of a resolved bibliography line (as Zotero's native
// citation popup already shows it) into rough structured fields. This is
// heuristic, not a real reference parser - citation styles vary (numeric,
// author-year, different venues), so any of these fields can come back
// undefined. Callers should treat a partial/empty result as normal, not
// an error.

export interface ParsedReference {
  raw: string;
  authors?: string;
  year?: string;
  title?: string;
  doi?: string;
}

const LEADING_MARKER = /^\[\d+\]\s*/;
const DOI_PATTERN = /\b10\.\d{4,9}\/\S+\b/;
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;

export function parseReferenceText(rawText: string): ParsedReference {
  const raw = rawText.trim();
  const text = raw.replace(LEADING_MARKER, "");

  const doi = text.match(DOI_PATTERN)?.[0]?.replace(/[.,]+$/, "");

  const yearMatch = text.match(YEAR_PATTERN);
  if (!yearMatch || yearMatch.index === undefined) {
    return { raw, doi };
  }

  const authors =
    text
      .slice(0, yearMatch.index)
      .replace(/\.\s*$/, "")
      .trim() || undefined;

  const afterYear = text
    .slice(yearMatch.index + yearMatch[0].length)
    .replace(/^\.\s*/, "");
  const titleEnd = afterYear.indexOf(". ");
  const title =
    (titleEnd === -1 ? afterYear : afterYear.slice(0, titleEnd)).trim() ||
    undefined;

  return { raw, authors, year: yearMatch[0], title, doi };
}
