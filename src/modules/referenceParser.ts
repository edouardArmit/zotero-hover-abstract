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
const YEAR_PATTERN_GLOBAL = /\b(19|20)\d{2}\b/g;
// IEEE and similar styles put the title in quotes, straight or curly:
//   L. H. Hsia and G. J. Hwang, "A title," Journal, vol. 52, 2021.
const QUOTED_TITLE_PATTERN = /["\u201C]([^"\u201D]+)["\u201D]/;

export function parseReferenceText(rawText: string): ParsedReference {
  const raw = rawText.trim();
  const text = raw.replace(LEADING_MARKER, "");

  const doi = text.match(DOI_PATTERN)?.[0]?.replace(/[.,]+$/, "");

  const quoted = parseQuotedTitleStyle(text);
  if (quoted) return { raw, doi, ...quoted };

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

/** Authors before the quoted title; the year usually comes last, after the venue. */
function parseQuotedTitleStyle(
  text: string,
): Omit<ParsedReference, "raw" | "doi"> | undefined {
  const match = text.match(QUOTED_TITLE_PATTERN);
  if (!match || match.index === undefined) return undefined;
  // In author-year styles (ACM, APA) the year precedes the title, so a quote
  // appearing after the first year is part of the title, not delimiting it.
  const firstYear = text.search(YEAR_PATTERN);
  if (firstYear !== -1 && firstYear < match.index) return undefined;

  const title = match[1].replace(/[\s,.]+$/, "").trim();
  if (!title) return undefined;

  const authors =
    text
      .slice(0, match.index)
      .replace(/[\s,]+$/, "")
      .trim() || undefined;
  const years = text.match(YEAR_PATTERN_GLOBAL);
  return { authors, title, year: years?.[years.length - 1] };
}
