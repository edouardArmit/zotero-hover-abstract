import { combineLibraryStatuses, type LibraryStatus } from "./lookupReport";
import type { ParsedReference } from "./referenceParser";

/**
 * Look a parsed reference up in the user's own library, then in each group
 * library, and report whether it's there and whether it has an abstract
 * (see combineLibraryStatuses for how copies in several libraries are
 * merged). Feeds are skipped: they're RSS items, not the user's references.
 * Never throws: a failed search is reported as an error status.
 */
export async function resolveLocalAbstract(
  parsed: ParsedReference,
): Promise<LibraryStatus> {
  const statuses: LibraryStatus[] = [];
  for (const library of searchableLibraries()) {
    const status = await resolveInLibrary(parsed, library.libraryID);
    const groupName =
      library.libraryType === "group" ? library.name : undefined;
    if (status.kind === "found") return { ...status, groupName };
    statuses.push(
      status.kind === "noAbstract" ? { ...status, groupName } : status,
    );
  }
  return combineLibraryStatuses(statuses);
}

/** My Library first, then groups alphabetically - the order results are preferred in. */
function searchableLibraries(): _ZoteroTypes.Library.LibraryLike[] {
  const libraries = Zotero.Libraries.getAll();
  const user = libraries.filter((l) => l.libraryType === "user");
  const groups = libraries
    .filter((l) => l.libraryType === "group")
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...user, ...groups];
}

/**
 * A DOI match (when we have one) is tried first since it's exact; a
 * title/creator "contains" search is a much fuzzier fallback and can both
 * miss real matches and hit wrong ones.
 */
async function resolveInLibrary(
  parsed: ParsedReference,
  libraryID: number,
): Promise<LibraryStatus> {
  try {
    const itemID =
      (parsed.doi && (await findItemIDByDOI(parsed.doi, libraryID))) ||
      (parsed.title &&
        (await findItemIDByTitle(parsed.title, parsed.authors, libraryID)));
    if (!itemID) return { kind: "notInLibrary" };

    const item = await Zotero.Items.getAsync(itemID);
    if (!item) return { kind: "notInLibrary" };
    // Zotero loads item fields lazily: an item in a library the user hasn't
    // browsed this session (typically a group) throws "Item data not
    // loaded" on getField() unless its fields are loaded first.
    await item.loadDataType("itemData");
    const abstractNote = String(item.getField("abstractNote") ?? "").trim();
    return abstractNote
      ? { kind: "found", abstract: abstractNote }
      : { kind: "noAbstract" };
  } catch (e: any) {
    return { kind: "error", message: String(e?.message ?? e) };
  }
}

async function findItemIDByDOI(
  doi: string,
  libraryID: number,
): Promise<number | undefined> {
  const ids = await runSearch(libraryID, (search) => {
    search.addCondition("DOI", "is", doi);
  });
  return ids[0];
}

async function findItemIDByTitle(
  title: string,
  authors: string | undefined,
  libraryID: number,
): Promise<number | undefined> {
  const ids = await runSearch(libraryID, (search) => {
    search.addCondition("joinMode", "all");
    search.addCondition("title", "contains", title);
    const lastName = authors && firstAuthorLastName(authors);
    if (lastName) {
      search.addCondition("creator", "contains", lastName);
    }
  });
  return ids[0];
}

// Zotero.Search excludes trashed items by default.
async function runSearch(
  libraryID: number,
  configure: (search: Zotero.Search) => void,
): Promise<number[]> {
  const search = new Zotero.Search({ libraryID });
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
