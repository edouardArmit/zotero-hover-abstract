import { config } from "../../package.json";
import { combineLibraryStatuses, type LibraryStatus } from "./lookupReport";
import type { ParsedReference } from "./referenceParser";
import {
  firstAuthorLastName,
  pickBestMatch,
  retrievalWords,
  type TitleCandidate,
} from "./titleMatch";

// Upper bound on candidates scored per library by the fuzzy fallback - a
// loose "title contains any distinctive word" search can return many.
const MAX_FUZZY_CANDIDATES = 2000;

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
        ((await findItemIDByTitle(parsed.title, parsed.authors, libraryID)) ||
          (await findItemIDByFuzzyTitle(
            parsed.title,
            parsed.authors,
            libraryID,
          ))));
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
  return firstRegularItemID(ids);
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
  return firstRegularItemID(ids);
}

/**
 * Fallback when the exact "title contains" search misses, typically because
 * the PDF's text layer mangled the title (lost hyphens, ligatures, accents).
 * Fetches candidates loosely - title contains any of the most distinctive
 * words, or a creator matches the first author - then scores them in
 * titleMatch.ts, which also guards against near-matches on generic titles.
 */
async function findItemIDByFuzzyTitle(
  title: string,
  authors: string | undefined,
  libraryID: number,
): Promise<number | undefined> {
  const words = retrievalWords(title);
  const lastName = authors ? firstAuthorLastName(authors) : undefined;
  if (!words.length && !lastName) return undefined;

  const ids = await runSearch(libraryID, (search) => {
    search.addCondition("joinMode", "any");
    for (const word of words) search.addCondition("title", "contains", word);
    if (lastName) search.addCondition("creator", "contains", lastName);
  });
  if (!ids.length) return undefined;

  const items = (
    await Zotero.Items.getAsync(ids.slice(0, MAX_FUZZY_CANDIDATES))
  ).filter((item) => item?.isRegularItem());
  // One batched load for all candidates rather than one query per item
  // (see resolveInLibrary on why fields must be loaded explicitly).
  await Zotero.Items.loadDataTypes(items, ["itemData", "creators"]);

  const candidates: TitleCandidate[] = items.map((item) => ({
    id: item.id,
    title: String(item.getField("title") ?? ""),
    creatorLastNames: item.getCreators().map((c) => c.lastName ?? ""),
  }));
  const match = pickBestMatch(title, lastName, candidates);
  if (match) {
    ztoolkit.log(
      `[${config.addonRef}] fuzzy title match in library ${libraryID}: item ${match.id}, similarity ${match.similarity.toFixed(2)}`,
    );
  }
  return match?.id;
}

/**
 * Search results include attachments and notes, whose titles often contain
 * the paper's title (e.g. "Author - 2020 - Title.pdf") but which have no
 * abstract field - skip to the first regular item.
 */
async function firstRegularItemID(ids: number[]): Promise<number | undefined> {
  if (!ids.length) return undefined;
  const items = await Zotero.Items.getAsync(ids);
  return items.find((item) => item?.isRegularItem())?.id;
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
