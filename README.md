# Zotero Hover Abstract

A Zotero (7+/10) plugin: while reading a PDF in Zotero's built-in reader, hovering an in-text citation shows the cited work's abstract. Zotero already shows a native popup with the resolved reference on hover (since Zotero 7) — this plugin observes that popup and augments it with the abstract.

**This branch (`main`) is v1: local library only.** It shows the abstract when the cited work is already in your own Zotero library with an `abstractNote` filled in — no network calls, no external services, nothing leaves your machine. For citations not yet in your library, see the `external-fallback` branch, which adds Crossref and Semantic Scholar lookups (more useful, but with real added complexity: rate limits, an optional API key, and sending reference text to third parties).

## How it was built

Built in stages, each verified in a real Zotero install before the next started:

- **Stage 0** — bare plugin scaffold: loads in Zotero, no feature logic yet.
- **Stage 1** — detect Zotero's native citation popup (`.citation-popup` in `reader._iframeWindow.document`) via `MutationObserver` and read its resolved reference text.
- **Stage 2** — parse the popup's reference text into `{authors, year, title, doi}` (`src/modules/referenceParser.ts`), best-effort.
- **Stage 3** — resolve to a local Zotero item via DOI or title/creator search (`src/modules/libraryResolver.ts`).
- **Stage 3b** — inject the found abstract into the visible popup itself (`src/modules/popupInjector.ts`).

(Stages 4+, adding external providers, continue on the `external-fallback` branch.)

Known limitations (by design, not bugs): this only works for proper text-layer PDFs (no OCR/scanned-PDF support); it depends on Zotero's own citation-popup DOM structure, which is not a documented/stable plugin API — a future Zotero release could silently break it; and it only shows an abstract for works already in your Zotero library with that field filled in.

## Dev setup

1. `npm install`
2. Copy `.env.example` → `.env` (already done in this checkout) and fill in:
   - `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` — path to your Zotero binary (already set for macOS).
   - `ZOTERO_PLUGIN_PROFILE_PATH` — a **dedicated dev profile**, not your real one. Create one with:
     ```bash
     /Applications/Zotero.app/Contents/MacOS/zotero -P
     ```
     then pick "Create Profile..." in the dialog and copy its path in. Don't point this at your everyday Zotero profile — `npm run start` restarts Zotero using whatever profile you configure here.
3. `npm run start` — launches Zotero with the plugin loaded and hot-reloads on save. **Config/`.env` changes need a full restart**, not just a save — the hot-reload watcher only picks up source file edits.
4. `npm run build` — produces a `.xpi` in `.scaffold/build/` you can install manually via Zotero's Tools → Plugins → gear icon → "Install Plugin From File".

## Project structure

```
addon/manifest.json              - plugin metadata, strict_min/max_version
addon/bootstrap.js               - startup/shutdown/install/uninstall lifecycle
addon/content/preferences.xhtml  - preferences pane markup
addon/locale/en-US/*.ftl         - Fluent strings
src/index.ts                     - bootstrap entry, lifecycle wiring
src/hooks.ts                     - lifecycle dispatch, reader-tab notifier registration
src/modules/popupObserver.ts     - detects Zotero's native citation popup, reads its reference text
src/modules/referenceParser.ts   - best-effort parse of the reference text into {authors, year, title, doi}
src/modules/libraryResolver.ts   - resolves a parsed reference to a local item's abstractNote (DOI or title/creator search)
src/modules/abstractCache.ts     - in-memory cache of resolved (and confirmed-missing) abstracts per session
src/modules/popupInjector.ts     - appends the found abstract into the visible native popup
src/modules/preferenceScript.ts  - preferences pane logic
src/utils/                       - locale, ztoolkit, window helpers
```
