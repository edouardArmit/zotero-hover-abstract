import type { LibraryStatus } from "./lookupReport";
import type { ParsedReference } from "./referenceParser";

/**
 * Try to find a local Zotero item matching a parsed reference, and report
 * whether it's there and whether it has an abstract. A DOI match (when we
 * have one) is tried first since it's exact; a title/creator "contains"
 * search is a much fuzzier fallback and can both miss real matches and hit
 * wrong ones. Never throws: a failed search is reported as an error status.
 */
export async function resolveLocalAbstract(
  parsed: ParsedReference,
): Promise<LibraryStatus> {
  try {
    const itemID =
      (parsed.doi && (await findItemIDByDOI(parsed.doi))) ||
      (parsed.title && (await findItemIDByTitle(parsed.title, parsed.authors)));
    if (!itemID) return { kind: "notInLibrary" };

    const item = await Zotero.Items.getAsync(itemID);
    if (!item) return { kind: "notInLibrary" };
    const abstractNote = String(item.getField("abstractNote") ?? "").trim();
    return abstractNote
      ? { kind: "found", abstract: abstractNote }
      : { kind: "noAbstract" };
  } catch (e: any) {
    return { kind: "error", message: String(e?.message ?? e) };
  }
}

async function findItemIDByDOI(doi: string): Promise<number | undefined> {
  const ids = await runSearch((search) => {
    search.addCondition("DOI", "is", doi);
  });
  return ids[0];
}

async function findItemIDByTitle(
  title: string,
  authors: string | undefined,
): Promise<number | undefined> {
  const ids = await runSearch((search) => {
    search.addCondition("joinMode", "all");
    search.addCondition("title", "contains", title);
    const lastName = authors && firstAuthorLastName(authors);
    if (lastName) {
      search.addCondition("creator", "contains", lastName);
    }
  });
  return ids[0];
}

async function runSearch(
  configure: (search: Zotero.Search) => void,
): Promise<number[]> {
  const search = new Zotero.Search({
    libraryID: Zotero.Libraries.userLibraryID,
  });
  configure(search);
  return search.search();
}

/** "Andrew Luxton-Reilly, Simon, ..." -> rough guess: "Luxton-Reilly" */
function firstAuthorLastName(authors: string): string | undefined {
  const firstAuthor = authors.split(",")[0]?.trim();
  if (!firstAuthor) return undefined;
  const words = firstAuthor.split(/\s+/);
  return words[words.length - 1];
}
