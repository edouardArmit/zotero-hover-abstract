# Zotero Hover Abstract

A Zotero (7+/10) plugin: while reading a PDF in Zotero's built-in reader, hovering an in-text citation shows the cited work's abstract. Zotero already shows a native popup with the resolved reference on hover (since Zotero 7) — this plugin observes that popup and augments it with the abstract, preferring the local library's `abstractNote` and falling back to an external metadata API (Crossref) when not available locally.

This is being built in stages, each one verified in a real Zotero install before the next starts. See the current plan/status below.

## Stages

- **Stage 0 (done)** — bare plugin scaffold: loads in Zotero, no feature logic yet.
- **Stage 1 (done)** — detect Zotero's native citation popup (`.citation-popup` in `reader._iframeWindow.document`) via `MutationObserver` and read its resolved reference text.
- **Stage 2 (done)** — parse the popup's reference text into `{authors, year, title, doi}` (`src/modules/referenceParser.ts`), best-effort.
- **Stage 3 (done)** — resolve to a local Zotero item via DOI or title/creator search (`src/modules/libraryResolver.ts`).
- **Stage 3b (done)** — inject the found abstract into the visible popup itself (`src/modules/popupInjector.ts`). This is the first stage where the feature is actually visible, not just logged.
- **Stage 4** — fall back to Crossref when there's no local abstract.
- **Stage 5** — preferences pane, caching, polish.

Known limitations (by design, not bugs): this only works for proper text-layer PDFs (no OCR/scanned-PDF support), and it depends on Zotero's own citation-popup DOM structure, which is not a documented/stable plugin API — a future Zotero release could silently break it.

## Dev setup

1. `npm install`
2. Copy `.env.example` → `.env` (already done in this checkout) and fill in:
   - `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` — path to your Zotero binary (already set for macOS).
   - `ZOTERO_PLUGIN_PROFILE_PATH` — a **dedicated dev profile**, not your real one. Create one with:
     ```bash
     /Applications/Zotero.app/Contents/MacOS/zotero -P
     ```
     then pick "Create Profile..." in the dialog and copy its path in. Don't point this at your everyday Zotero profile — `npm run start` restarts Zotero using whatever profile you configure here.
3. `npm run start` — launches Zotero with the plugin loaded and hot-reloads on save.
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
src/modules/popupInjector.ts     - appends the found abstract into the visible native popup
src/modules/preferenceScript.ts  - preferences pane logic
src/utils/                       - locale, ztoolkit, window helpers
```

Update `package.json`'s `repository.url` once this is pushed to an actual GitHub repo (currently a placeholder — `zotero-plugin.config.ts` needs a valid `owner/repo` to resolve, even for local builds).
