// Appends content into Zotero's own citation popup, rather than building a
// separate tooltip - the popup element belongs to the reader's iframe
// document, so all nodes here must be created via referenceRowEl.ownerDocument.
// A popup can contain multiple .reference-row elements when the in-text
// citation groups several works together (e.g. "[27, 33]") - each row gets
// its own injected content, keyed to that row specifically, not the popup
// as a whole (otherwise multiple abstracts injected at the popup level would
// be ambiguous about which reference they belong to).

const INJECTED_MARKER = "data-hoverabstract-injected";

const DIVIDER_STYLE =
  "margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(128,128,128,0.4); font-size: 0.9em; max-width: 32em;";

export function injectAbstractIntoRow(
  referenceRowEl: Element,
  abstractText: string,
): void {
  const doc = referenceRowEl.ownerDocument;
  if (!doc) return;

  const label = doc.createElement("div");
  label.textContent = "Abstract";
  label.setAttribute(
    "style",
    "font-weight: 600; margin-bottom: 2px; opacity: 0.7;",
  );

  const body = doc.createElement("div");
  body.textContent = abstractText;

  const container = doc.createElement("div");
  container.setAttribute("style", DIVIDER_STYLE);
  container.append(label, body);

  appendOnce(referenceRowEl, container);
}

export function injectNoAbstractFoundLabel(referenceRowEl: Element): void {
  const doc = referenceRowEl.ownerDocument;
  if (!doc) return;

  const label = doc.createElement("div");
  label.textContent = "No abstract found";
  label.setAttribute(
    "style",
    `${DIVIDER_STYLE} font-style: italic; opacity: 0.6;`,
  );

  appendOnce(referenceRowEl, label);
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
