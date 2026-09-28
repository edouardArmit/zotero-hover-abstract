import { config } from "../../package.json";
import { getCachedResults, setCachedResults } from "./abstractCache";
import { fetchCrossrefAbstract } from "./crossref";
import { resolveLocalAbstract } from "./libraryResolver";
import {
  formatReport,
  type ExternalResults,
  type LookupReport,
} from "./lookupReport";
import { isError, type LookupResult } from "./lookupResult";
import { injectReport } from "./popupInjector";
import { parseReferenceText, type ParsedReference } from "./referenceParser";
import { fetchSemanticScholarAbstract } from "./semanticScholar";
import { getPref } from "../utils/prefs";

// Zotero's native citation-hover popup (reader._iframeWindow, class "citation-popup")
// is an undocumented internal implementation detail, not a public plugin API.
// Confirmed by hand in Zotero 10 via the Browser Toolbox - see project notes.
// A future Zotero release could change this structure without notice; if the
// class name or frame stops matching, this observer simply stops finding
// anything (no crash), which is the intended fail-closed behavior.
const CITATION_POPUP_CLASS = "citation-popup";
const REFERENCE_TEXT_SELECTOR = ".reference-row";

const attachedReaders = new Map<string, MutationObserver>();

export function attachToReader(reader: _ZoteroTypes.ReaderInstance): void {
  if (attachedReaders.has(reader._instanceID)) return;

  const win = reader._iframeWindow;
  const doc = win?.document;
  // This bundle runs in a privileged bootstrap scope, not a normal web page,
  // so there is no global MutationObserver - it has to come from the reader's
  // own content window instead.
  if (!doc?.body || !win?.MutationObserver) return;

  const observer = new win.MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // `node` belongs to the reader's iframe window, a different global
        // than this module's - `instanceof Element` would fail across that
        // boundary, so check nodeType instead.
        if (!node || node.nodeType !== 1) continue;
        const el = node as Element;
        if (!el.classList.contains(CITATION_POPUP_CLASS)) continue;

        // A grouped in-text citation (e.g. "[27, 33]") renders as multiple
        // .reference-row elements in one popup - handle every row, not just
        // the first (querySelector would silently drop the rest).
        const referenceRows = el.querySelectorAll(REFERENCE_TEXT_SELECTOR);
        for (const row of referenceRows) {
          const referenceText = row.textContent?.trim();
          if (!referenceText) continue;

          const parsed = parseReferenceText(referenceText);
          ztoolkit.log(`[${config.addonRef}] parsed reference:`, parsed);

          // Fire-and-forget per row, so catch here: an unhandled rejection
          // would otherwise vanish silently, leaving the popup unchanged
          // with no trace of why.
          resolveAndInject(parsed, row).catch((e) =>
            ztoolkit.log(`[${config.addonRef}] lookup failed:`, e),
          );
        }
      }
    }
  });

  observer.observe(doc.body, { childList: true, subtree: true });
  attachedReaders.set(reader._instanceID, observer);
}

async function resolveAndInject(
  parsed: ParsedReference,
  referenceRowEl: Element,
): Promise<void> {
  if (!getPref("enable")) {
    ztoolkit.log(`[${config.addonRef}] plugin disabled in Settings, skipping`);
    return;
  }

  const report = await buildReport(parsed);
  ztoolkit.log(
    `[${config.addonRef}] lookup report for "${parsed.title ?? parsed.raw}": ${summarizeReport(report)}`,
    report,
  );
  injectReport(
    referenceRowEl,
    formatReport(report, {
      settingsName: config.addonName,
      now: Date.now(),
      showCacheAge: addon.data.env === "development",
    }),
  );
}

/** e.g. "library=notInLibrary crossref=missing:noAbstract semanticScholar=error:rateLimited(429)" */
function summarizeReport(report: LookupReport): string {
  const describe = (r: LookupResult | undefined) =>
    !r
      ? "not queried"
      : r.kind === "missing"
        ? `missing:${r.detail}`
        : r.kind === "error"
          ? `error:${r.failure.reason}(${r.failure.status ?? "no status"})`
          : "found";
  const external =
    report.external === "disabled"
      ? "external=off"
      : `crossref=${describe(report.external.crossref)} semanticScholar=${describe(report.external.semanticScholar)}`;
  const cached = report.cachedAt === undefined ? "" : " (cached)";
  return `library=${report.library.kind} ${external}${cached}`;
}

async function buildReport(parsed: ParsedReference): Promise<LookupReport> {
  // The local library is checked first and never cached: it's a fast local
  // query, and not caching it means an abstract the user adds or edits in
  // Zotero shows up on the very next hover.
  const library = await resolveLocalAbstract(parsed);
  // (A library hit never shows per-source lines, so "disabled" here just
  // means "not consulted".)
  if (library.kind === "found") return { library, external: "disabled" };
  if (!getPref("enableExternalLookups")) {
    return { library, external: "disabled" };
  }

  const cached = getCachedResults(parsed);
  if (cached) {
    return { library, external: cached.results, cachedAt: cached.storedAt };
  }

  const external = await lookUpExternally(parsed);
  // Results with an error are deliberately not cached: a rate limit or
  // network blip should be retried on the next hover, not remembered.
  if (!isError(external.crossref) && !isError(external.semanticScholar)) {
    setCachedResults(parsed, external);
  }
  return { library, external };
}

async function lookUpExternally(
  parsed: ParsedReference,
): Promise<ExternalResults> {
  const crossref = await fetchCrossrefAbstract(parsed);
  if (crossref.kind === "found") return { crossref };
  return {
    crossref,
    semanticScholar: await fetchSemanticScholarAbstract(parsed),
  };
}

export function detachAll(): void {
  for (const observer of attachedReaders.values()) {
    observer.disconnect();
  }
  attachedReaders.clear();
}
