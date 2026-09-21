// Appends content into Zotero's own citation popup, rather than building
// a separate tooltip - the popup element belongs to the reader's iframe
// document, so all nodes here must be created via popupEl.ownerDocument.

const INJECTED_MARKER = "data-hoverabstract-injected";

const DIVIDER_STYLE =
  "margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(128,128,128,0.4); font-size: 0.9em; max-width: 32em;";

export function injectAbstractIntoPopup(
  popupEl: Element,
  abstractText: string,
): void {
  const doc = popupEl.ownerDocument;
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

  appendOnce(popupEl, container);
}

export function injectNoAbstractFoundLabel(popupEl: Element): void {
  const doc = popupEl.ownerDocument;
  if (!doc) return;

  const label = doc.createElement("div");
  label.textContent = "No abstract found in your library";
  label.setAttribute(
    "style",
    `${DIVIDER_STYLE} font-style: italic; opacity: 0.6;`,
  );

  appendOnce(popupEl, label);
}

function appendOnce(popupEl: Element, node: Element): void {
  // Guard against double-injection (defensive - in practice Zotero recreates
  // the popup element fresh on each hover) and against injecting into a
  // popup the user has already moved away from and been removed from the DOM.
  if (popupEl.hasAttribute(INJECTED_MARKER) || !popupEl.isConnected) return;

  const inner = popupEl.querySelector(".inner") ?? popupEl;
  inner.appendChild(node);
  popupEl.setAttribute(INJECTED_MARKER, "true");
}
