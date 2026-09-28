// Pure fuzzy matching of a reference's title against library item titles.
//
// Reference text comes from the PDF's text layer, which routinely mangles
// titles: hyphens lost at line breaks ("solvingbased" for "solving-based",
// "21stcentury" for "21st-Century"), ligatures, accents, stray spaces. An
// exact "title contains" search misses all of these, so libraryResolver.ts
// falls back to fetching candidates loosely and scoring them here.

export interface TitleCandidate {
  id: number;
  title: string;
  creatorLastNames: string[];
}

/** Similarity at or above which two titles count as the same work. */
export const MIN_SIMILARITY = 0.88;

const MIN_WORD_LENGTH = 5;
const MAX_RETRIEVAL_WORDS = 3;

/**
 * Lowercase, strip accents, and drop everything but letters and digits -
 * including spaces, since PDF extraction both loses and invents them.
 */
export function compactTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Dice coefficient over character bigrams of the compacted titles: 1 for
 * identical, near 1 for a typo or a couple of missing/extra characters,
 * low for unrelated titles.
 */
export function titleSimilarity(a: string, b: string): number {
  const x = compactTitle(a);
  const y = compactTitle(b);
  if (x === y) return x ? 1 : 0;
  if (x.length < 2 || y.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < x.length - 1; i++) {
    const bigram = x.slice(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }
  let shared = 0;
  for (let i = 0; i < y.length - 1; i++) {
    const bigram = y.slice(i, i + 2);
    const count = bigrams.get(bigram) ?? 0;
    if (count > 0) {
      shared++;
      bigrams.set(bigram, count - 1);
    }
  }
  return (2 * shared) / (x.length - 1 + (y.length - 1));
}

/**
 * The title's most distinctive words, for fetching candidates with a loose
 * "title contains any of these" search. Only purely alphabetic words are
 * used: a mangled token like "21stcentury" won't appear in the real title.
 */
export function retrievalWords(title: string): string[] {
  // Split on whitespace, not on every non-letter: splitting "21stcentury"
  // on the digits would yield the equally mangled "stcentury". Hyphenated
  // words are skipped too - their hyphen is exactly what extraction loses.
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").toLowerCase())
    .filter((w) => w.length >= MIN_WORD_LENGTH && /^[a-z]+$/.test(w));
  return [...new Set(words)]
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_RETRIEVAL_WORDS);
}

/**
 * First author's last name, from the reference's author string - rough, but
 * handles the common styles: "Andrew Luxton-Reilly, Simon, ..." (ACM),
 * "S. Weiss and O. Wilhelm" (IEEE), "Smith, J., & Doe, K." (APA, where the
 * last name comes first and the next comma-separated part is initials).
 */
export function firstAuthorLastName(authors: string): string | undefined {
  // "et al." has to go first, or "B. Thornhill-Miller et al." yields "al."
  const first = authors
    .replace(/\s*\bet\s+al\b\.?/gi, "")
    .split(/,|\s+and\s+|\s*&\s*/)[0]
    ?.trim();
  if (!first) return undefined;
  const words = first.split(/\s+/).filter((w) => !/^[A-Z]\.?$/.test(w));
  return words[words.length - 1] || undefined;
}

/**
 * The candidate that best matches the reference title, if any is close
 * enough. An exact match (after compacting) is always accepted; a merely
 * similar one also needs the first author's last name to appear among the
 * candidate's creators, when we know it - that's what stops a short,
 * generic title ("Computational Thinking") matching the wrong work.
 */
export function pickBestMatch(
  refTitle: string,
  refLastName: string | undefined,
  candidates: TitleCandidate[],
): { id: number; similarity: number } | undefined {
  const lastName = refLastName && compactTitle(refLastName);
  let best: { id: number; similarity: number } | undefined;

  for (const candidate of candidates) {
    const similarity = titleSimilarity(refTitle, candidate.title);
    if (similarity < MIN_SIMILARITY) continue;
    if (similarity < 1 && lastName) {
      // Containment, not equality: "Villiers" parsed from "R De Villiers"
      // must still match a creator stored as "De Villiers".
      const hasAuthor = candidate.creatorLastNames.some((name) => {
        const creator = compactTitle(name);
        return (
          creator.length > 1 &&
          (creator.includes(lastName) || lastName.includes(creator))
        );
      });
      if (!hasAuthor) continue;
    }
    if (!best || similarity > best.similarity) {
      best = { id: candidate.id, similarity };
    }
  }
  return best;
}
