// Appends content into Zotero's own citation popup, rather than building a
// separate tooltip - the popup element belongs to the reader's iframe
// document, so all nodes here must be created via referenceRowEl.ownerDocument.
// A popup can contain multiple .reference-row elements when the in-text
// citation groups several works together (e.g. "[27, 33]") - each row gets
// its own injected content, keyed to that row specifically, not the popup
// as a whole (otherwise multiple abstracts injected at the popup level would
// be ambiguous about which reference they belong to).

import type { FormattedReport } from "./lookupReport";

const INJECTED_MARKER = "data-hoverabstract-injected";

const DIVIDER_STYLE =
  "margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(128,128,128,0.4); font-size: 0.9em; max-width: 32em;";

/**
 * Append a heading ("Abstract (from Crossref)" / "No abstract found") and
 * then either the abstract text or one dimmed status line per source.
 */
export function injectReport(
  referenceRowEl: Element,
  report: FormattedReport,
): void {
  const doc = referenceRowEl.ownerDocument;
  if (!doc) return;

  const heading = doc.createElement("div");
  heading.textContent = report.heading;
  heading.setAttribute(
    "style",
    "font-weight: 600; margin-bottom: 2px; opacity: 0.7;",
  );

  const container = doc.createElement("div");
  container.setAttribute("style", DIVIDER_STYLE);
  container.append(heading);

  if (report.abstract) {
    const body = doc.createElement("div");
    body.textContent = report.abstract;
    container.append(body);
  }
  for (const detail of report.details) {
    const line = doc.createElement("div");
    line.textContent = detail;
    line.setAttribute("style", "font-style: italic; opacity: 0.6;");
    container.append(line);
  }

  appendOnce(referenceRowEl, container);
}

function appendOnce(referenceRowEl: Element, node: Element): void {
  // Guard against double-injection (defensive - in practice Zotero recreates
  // the popup fresh on each hover) and against injecting into a row whose
  // popup the user has already moved away from and been removed from the DOM.
  if (
    referenceRowEl.hasAttribute(INJECTED_MARKER) ||
    !referenceRowEl.isConnected
  ) {
    return;
  }

  referenceRowEl.appendChild(node);
  referenceRowEl.setAttribute(INJECTED_MARKER, "true");
}
