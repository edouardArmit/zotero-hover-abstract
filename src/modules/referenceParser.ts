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

  const apa = parseApaStyle(text);
  if (apa) return { raw, doi, ...apa };

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

  return { raw, authors, year: yearMatch[0], title: titleFrom(afterYear), doi };
}

// APA puts the year in parentheses right after the authors, optionally with a
// letter suffix or a date: "Skinner, E. A. (1996). A guide to constructs...".
const APA_YEAR_PATTERN = /\(((?:19|20)\d{2})[a-z]?(?:,[^)]*)?\)\.?/;

/**
 * Without this, the generic path finds "1996" inside "(1996)." and takes ")"
 * as the title and "Skinner, E. A. (" as the authors. Applies only when the
 * parenthesised year is the first year in the text, so ACM-style references
 * ("Name. 2018. Title. ... (SIGCSE '19)") keep the generic path.
 */
function parseApaStyle(
  text: string,
): Omit<ParsedReference, "raw" | "doi"> | undefined {
  const match = text.match(APA_YEAR_PATTERN);
  if (!match || match.index === undefined) return undefined;
  if (text.search(/(?:19|20)\d{2}/) !== match.index + 1) return undefined;

  const authors = text.slice(0, match.index).trim() || undefined;
  // APA authors end with a name or an initial ("Skinner, E. A."). A number
  // there means the parenthesised year follows a venue's volume/issue instead,
  // as in CACM style: "... SIGCSE Bull. 39, 2 (2007), 32-36.".
  if (authors && /\d$/.test(authors)) return undefined;
  const title = titleFrom(text.slice(match.index + match[0].length));
  return { authors, year: match[1], title };
}

/** The title is everything up to the first ". ", minus a venue after "?"/"!". */
function titleFrom(textAfterYear: string): string | undefined {
  const rest = textAfterYear.trim();
  const titleEnd = rest.indexOf(". ");
  return (
    endAtQuestionOrExclamation(
      (titleEnd === -1 ? rest : rest.slice(0, titleEnd)).trim(),
    ) || undefined
  );
}

// A year or a page range such as "695–729": text that belongs to the venue.
const VENUE_HINT = /\b(19|20)\d{2}\b|\d+\s*[–-]\s*\d+/;

/**
 * A title ending in "?" or "!" has no ". " after it, so the venue runs into
 * it: "What are emotions? And how can they be measured? Social science
 * information 44, 4 (2005), 695–729." Cut after the last "?"/"!" only when
 * what follows looks like a venue. Otherwise the mark is inside the title, and
 * cutting there would send a too-short query to Semantic Scholar, whose title
 * search takes the top hit.
 */
function endAtQuestionOrExclamation(title: string): string {
  const lastMark = [...title.matchAll(/[?!](?=\s)/g)].pop();
  if (lastMark?.index === undefined) return title;
  const end = lastMark.index + 1;
  return VENUE_HINT.test(title.slice(end)) ? title.slice(0, end) : title;
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
