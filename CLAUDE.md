# CLAUDE.md

Guidance for Claude Code when working in this repo. Also read the global `swe-workflow` skill (`~/.claude/skills/swe-workflow/SKILL.md`) — it covers the general engineering process (staged builds, verify-before-ship, trunk-based git, secrets hygiene, etc.) this project follows; this file covers what's specific to _this_ codebase.

## What this is

A Zotero (7+/10) plugin. Zotero's built-in PDF reader has a native hover popup that shows the resolved reference (authors/title/etc.) for an in-text citation — this plugin observes that popup and injects the cited work's abstract into it. By default it only checks the user's local Zotero library (no network calls). An opt-in preference ("Also check Crossref and Semantic Scholar...", off by default) extends resolution to Crossref, then Semantic Scholar, for citations not in the library.

Repo: https://github.com/edouardArmit/zotero-hover-abstract (public). Single `main` branch, trunk-based (see `swe-workflow`). Current release: **v0.2.0**.

Scaffolded from `windingwind/zotero-plugin-template` (TypeScript, esbuild via `zotero-plugin-scaffold`, `zotero-plugin-toolkit`), then heavily stripped down — the template's demo/example code (extra columns, context menus, dialogs) was all removed; nothing in `src/` is template boilerplate anymore.

## Commands

```bash
npm install
npm run start       # launches a dev Zotero with the plugin loaded, hot-reloads src/*.ts on save
npm run build        # zotero-plugin build && tsc --noEmit -> .scaffold/build/*.xpi
npm run lint:check   # prettier --check + eslint
npm run lint:fix     # prettier --write + eslint --fix
npm run test:unit    # fast offline unit tests (mocha+chai via tsx), test/unit/ - no Zotero needed
npm run test         # zotero-plugin test - integration test, launches real headless Zotero
```

**`npm run start` gotcha**: hot-reload only rebuilds `src/*.ts`. Changes to `addon/` files (`preferences.xhtml`, `prefs.js`, `.ftl` locale files) or `.env`/`zotero-plugin.config.ts` need a full restart (`Ctrl+C`, rerun), not just a save.

**Dev profile**: `.env`'s `ZOTERO_PLUGIN_PROFILE_PATH` must point at a **dedicated dev profile**, never your real one (`npm run start` restarts Zotero using it). Create one via `/Applications/Zotero.app/Contents/MacOS/zotero -P`.

## Architecture

```
addon/manifest.json              - plugin metadata, strict_min/max_version
addon/bootstrap.js                - startup/shutdown/install/uninstall lifecycle
addon/content/preferences.xhtml   - preferences pane markup (enable, external-lookups toggle, API key field)
addon/prefs.js                    - preference defaults
addon/locale/en-US/*.ftl          - Fluent strings
src/index.ts                      - bootstrap entry, lifecycle wiring
src/hooks.ts                      - lifecycle dispatch; registers the preferences pane; reader-tab notifier registration
src/modules/popupObserver.ts      - detects the native citation popup, reads reference text per row, orchestrates resolution (cache -> local -> Crossref -> Semantic Scholar)
src/modules/referenceParser.ts    - pure: parses a reference string into {authors, year, title, doi}
src/modules/libraryResolver.ts    - resolves a parsed reference to a local Zotero item's abstractNote (DOI, then title/creator search)
src/modules/crossref.ts           - Crossref fallback lookup (DOI, then bibliographic search)
src/modules/semanticScholar.ts    - Semantic Scholar fallback lookup, retry/backoff on 429/5xx, optional API key
src/modules/textUtils.ts          - pure: stripXmlTags (JATS-XML), normalizeText
src/modules/abstractCache.ts      - in-memory cache of resolved (and confirmed-missing) abstracts, keyed by DOI or raw text
src/modules/popupInjector.ts      - appends the abstract (or "not found") into a specific .reference-row
src/utils/prefs.ts                - typed Zotero.Prefs get/set/clear wrappers
test/unit/                        - offline unit tests for the pure modules above
test/startup.test.ts              - Zotero-integration test
```

`popupObserver.ts` is the orchestrator: for each `.reference-row` in a detected `.citation-popup`, it checks the cache, then `libraryResolver`, then (only if `enableExternalLookups` pref is on) `crossref` then `semanticScholar`, injecting the result via `popupInjector`.

## Key gotchas discovered building this (don't rediscover these)

- **No hover-detection needed at all.** Zotero's reader has had a native citation-hover popup since v7 — hovering `[12]` (or a grouped `[27, 33]`) already shows the resolved reference(s). This plugin just observes that popup rather than reimplementing citation-marker parsing/hover detection from scratch.
- **The popup lives in `reader._iframeWindow.document`** (the outer reader wrapper), not the inner PDF content iframe (`_internalReader._primaryView._iframeWindow`, which only has PDF.js's own highlight overlays) and not the XUL popupset. Class `citation-popup`; a grouped citation renders **multiple** `.reference-row` elements in one popup — `querySelectorAll`, not `querySelector`, or you silently drop everything but the first.
- **No global `MutationObserver` (or other DOM APIs) in the bootstrap scope.** This bundle runs in a privileged sandbox, not a web page. Get `MutationObserver` off the target window (`reader._iframeWindow.MutationObserver`), not as a bare global.
- **Preferences pane needs explicit registration.** `Zotero.PreferencePanes.register({ pluginID, src, label })` in `onStartup` — without it, `preferences.xhtml` serves fine over `chrome://` but Zotero never surfaces a way to open it. The pane then lives in **Zotero's own Settings window** (app menu → Settings), _not_ Tools → Plugins (that's Firefox's generic Add-ons Manager and has no knowledge of it).
- **`Zotero.HTTP.request` has its own built-in retry-on-error.** Pass `errorDelayMax: 0` when implementing custom retry logic, or the two stack and multiply actual requests sent.
- **`Zotero.Promise.delay()`** works for sleep/delay (used for backoff) despite `zotero-types` not declaring it — needs an `as any` cast, documented inline where used.
- **Crossref abstract coverage is genuinely inconsistent** (many ACM papers have none - confirmed, not a bug). **Semantic Scholar has better CS coverage but a much stricter unauthenticated rate limit** — a free per-user API key (entered in the plugin's own preferences, never baked into the build) fixes this; see the "why per-user not a shared embedded key" note in the preferences field/README.

## Known open items / possible next steps

- The HTTP request/retry control flow in `crossref.ts`/`semanticScholar.ts` isn't unit-tested (would need mocking `Zotero.HTTP.request`) — only the pure helpers (URL builders, status classification, text normalization) are.
- `zotero-plugin-scaffold` is slightly behind latest (0.8.2 installed vs 0.9.2 available as of last check) — Dependabot's weekly grouped PRs should pick this up; not urgent.
- No CHANGELOG.md; release notes currently live only on GitHub Releases.
- GitHub Dependabot has ~36 open alerts, all in devDependencies (build tooling transitively pulled in by `zotero-plugin-scaffold`/eslint/mocha), none reachable in the shipped `.xpi` - reviewed, no action needed, left as-is.
