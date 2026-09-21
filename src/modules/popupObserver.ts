import { config } from "../../package.json";
import { getCachedAbstract, setCachedAbstract } from "./abstractCache";
import { resolveLocalAbstract } from "./libraryResolver";
import {
  injectAbstractIntoRow,
  injectNoAbstractFoundLabel,
} from "./popupInjector";
import { parseReferenceText, type ParsedReference } from "./referenceParser";
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

          resolveAndInject(parsed, row);
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
  if (!getPref("enable")) return;

  const cached = getCachedAbstract(parsed);
  if (cached !== undefined) {
    if (cached) {
      injectAbstractIntoRow(referenceRowEl, cached);
    } else {
      injectNoAbstractFoundLabel(referenceRowEl);
    }
    return;
  }

  const local = await resolveLocalAbstract(parsed).catch((e) => {
    ztoolkit.log(`[${config.addonRef}] local search failed:`, e);
    return undefined;
  });

  setCachedAbstract(parsed, local?.abstractNote ?? null);
  if (local) {
    ztoolkit.log(`[${config.addonRef}] local abstract found:`, local);
    injectAbstractIntoRow(referenceRowEl, local.abstractNote);
  } else {
    ztoolkit.log(
      `[${config.addonRef}] no local abstract for:`,
      parsed.title ?? parsed.raw,
    );
    injectNoAbstractFoundLabel(referenceRowEl);
  }
}

export function detachAll(): void {
  for (const observer of attachedReaders.values()) {
    observer.disconnect();
  }
  attachedReaders.clear();
}
