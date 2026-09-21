/**
 * Strip XML/HTML markup down to plain text, collapsing runs of whitespace.
 * Used for Crossref's JATS-XML abstracts (e.g. "<jats:p>...</jats:p>").
 * Returns undefined for empty/missing input or a result that's blank after
 * stripping, consistent with how a missing abstract is represented.
 */
export function stripXmlTags(xml: string | undefined): string | undefined {
  if (!xml) return undefined;
  const text = xml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

/**
 * Trim text and treat an empty/whitespace-only result as "no value".
 */
export function normalizeText(
  text: string | null | undefined,
): string | undefined {
  return text?.trim() || undefined;
}
