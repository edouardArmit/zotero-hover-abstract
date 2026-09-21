# Zotero Hover Abstract

A Zotero (7+/10) plugin: while reading a PDF in Zotero's built-in reader, hovering an in-text citation shows the cited work's abstract. Zotero already shows a native popup with the resolved reference on hover (since Zotero 7) — this plugin observes that popup and augments it with the abstract, preferring the local library's `abstractNote` and falling back to Crossref, then Semantic Scholar, when not available locally.

**This branch (`external-fallback`) is the fuller-featured line.** For a minimal, local-library-only version with no network calls, see `main`.

## How it was built

Built in stages, each verified in a real Zotero install before the next started:

- **Stage 0** — bare plugin scaffold: loads in Zotero, no feature logic yet.
- **Stage 1** — detect Zotero's native citation popup (`.citation-popup` in `reader._iframeWindow.document`) via `MutationObserver` and read its resolved reference text.
- **Stage 2** — parse the popup's reference text into `{authors, year, title, doi}` (`src/modules/referenceParser.ts`), best-effort.
- **Stage 3** — resolve to a local Zotero item via DOI or title/creator search (`src/modules/libraryResolver.ts`).
- **Stage 3b** — inject the found abstract into the visible popup itself (`src/modules/popupInjector.ts`).
- **Stage 4** — fall back to Crossref, then Semantic Scholar, when there's no local abstract, with an in-memory cache.
- **Stage 4b** — handled Semantic Scholar rate limits (exponential backoff, optional API key support).
- **Stage 5** — preferences pane: an "Enable" toggle that actually gates behavior, and a Semantic Scholar API key field backed by `Zotero.Prefs` (read fresh on every request, no rebuild needed to change it).
- Handles grouped in-text citations (e.g. "[27, 33]") — each reference in the group is resolved and shown independently.

Known limitations (by design, not bugs): this only works for proper text-layer PDFs (no OCR/scanned-PDF support); it depends on Zotero's own citation-popup DOM structure, which is not a documented/stable plugin API — a future Zotero release could silently break it; Crossref's abstract coverage is genuinely inconsistent (many publishers, notably ACM, don't deposit abstracts at all); and Semantic Scholar's unauthenticated tier has a rate limit that can be hit often depending on your network — entering a free API key in the plugin's preferences (Tools → Plugins → Zotero Hover Abstract → Preferences) fixes this and is recommended. Each user should get their own key rather than one being baked into the plugin — see the note in that preferences field.

## Attribution

This plugin uses the [Semantic Scholar API](https://www.semanticscholar.org/product/api) as a data source, per their [API license agreement](https://www.semanticscholar.org/product/api/license). If you build on or publish results derived from this project, please:

- Include an attribution to **Semantic Scholar** on your site or in published materials, and
- For scientific publications, cite [The Semantic Scholar Open Data Platform](https://www.semanticscholar.org/paper/The-Semantic-Scholar-Open-Data-Platform-Kinney-Anastasiades/cb92a7f9d9dbcf9145e32fdfa0e70e2a6b828eb1):

  > Kinney, R., et al. (2023). The Semantic Scholar Open Data Platform. _arXiv preprint arXiv:2301.10140._

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
4. In the dev Zotero, go to **Tools → Plugins → Zotero Hover Abstract → Preferences** to optionally enter a [free Semantic Scholar API key](https://www.semanticscholar.org/product/api#api-key-form) — recommended, see the rate-limit note above. This is a real preference (`Zotero.Prefs`), not a build-time secret, so it's never baked into the built plugin.
5. `npm run build` — produces a `.xpi` in `.scaffold/build/` you can install manually via Zotero's Tools → Plugins → gear icon → "Install Plugin From File".

## Project structure

```
addon/manifest.json              - plugin metadata, strict_min/max_version
addon/bootstrap.js               - startup/shutdown/install/uninstall lifecycle
addon/content/preferences.xhtml  - preferences pane markup (enable toggle, API key field)
addon/prefs.js                   - preference defaults
addon/locale/en-US/*.ftl         - Fluent strings
src/index.ts                     - bootstrap entry, lifecycle wiring
src/hooks.ts                     - lifecycle dispatch, reader-tab notifier registration
src/modules/popupObserver.ts     - detects Zotero's native citation popup, reads reference text per row
src/modules/referenceParser.ts   - best-effort parse of the reference text into {authors, year, title, doi}
src/modules/libraryResolver.ts   - resolves a parsed reference to a local item's abstractNote (DOI or title/creator search)
src/modules/crossref.ts          - Crossref fallback lookup (DOI, then bibliographic search)
src/modules/semanticScholar.ts   - Semantic Scholar fallback lookup, tried after Crossref
src/modules/abstractCache.ts     - in-memory cache of resolved (and confirmed-missing) abstracts per session
src/modules/popupInjector.ts     - appends the found abstract (or a "not found" note) into a specific reference row
src/modules/preferenceScript.ts  - preferences pane logic
src/utils/prefs.ts               - typed Zotero.Prefs get/set/clear wrappers
src/utils/                       - locale, ztoolkit, window helpers
```
