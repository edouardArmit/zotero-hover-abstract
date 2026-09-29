# CLAUDE.md

Guidance for Claude Code when working in this repo. Also read the global `swe-workflow` skill (`~/.claude/skills/swe-workflow/SKILL.md`) — it covers the general engineering process (staged builds, verify-before-ship, trunk-based git, secrets hygiene, etc.) this project follows; this file covers what's specific to _this_ codebase.

## What this is

A Zotero (7+/10) plugin. Zotero's built-in PDF reader has a native hover popup that shows the resolved reference (authors/title/etc.) for an in-text citation — this plugin observes that popup and injects the cited work's abstract into it. By default it only checks the user's local Zotero library (no network calls). An opt-in preference ("Also check Crossref and Semantic Scholar...", off by default) extends resolution to Crossref, then Semantic Scholar, for citations not in the library.

Repo: https://github.com/edouardArmit/zotero-hover-abstract (public). Single `main` branch, trunk-based (see `swe-workflow`). Current release: **v0.3.2**.

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

**npm 12+ refuses git dependencies by default** (`allow-git=none`). `zotero-types` pulls `pdfjs-dist` from a pinned GitHub commit, so a plain `npm install`/`npm ci` fails with "Fetching packages of type "git" have been disabled". Use `npm ci --allow-git=all` (CI's older npm doesn't need it).

**`npm run start` gotcha**: hot-reload only rebuilds `src/*.ts`. Changes to `addon/` files (`preferences.xhtml`, `prefs.js`, `.ftl` locale files) or `.env`/`zotero-plugin.config.ts` need a full restart (`Ctrl+C`, rerun), not just a save.

**Dev profile**: `.env`'s `ZOTERO_PLUGIN_PROFILE_PATH` must point at a **dedicated dev profile**, never your real one (`npm run start` restarts Zotero using it). Create one via `/Applications/Zotero.app/Contents/MacOS/zotero -P`.

## Releasing

Bump `version` in `package.json`, commit, then push an annotated `vX.Y.Z` tag (`git tag -a vX.Y.Z -m ... && git push origin main vX.Y.Z`). `.github/workflows/release.yml` then runs `zotero-plugin release` in CI, which:

1. creates the `vX.Y.Z` GitHub Release and uploads the `.xpi`, then
2. uploads `update.json`/`update-beta.json` to the `release` pre-release ("Release Manifest"), replacing the old ones. That file is what every installed copy's `update_url` polls, so **never delete the `release` tag/release**.

**Don't `gh release create vX.Y.Z` by hand**: step 1 calls the create-release API and fails if the release already exists, so the workflow would stop before refreshing `update.json`. Edit the release title/notes afterwards with `gh release edit` if needed. If you ever do have to publish a release manually, also replace `update.json` on the `release` release yourself. Its `update_hash` must be the sha512 of the **published** `.xpi`, not of a local rebuild: the build embeds `buildTime`, so rebuilding changes the hash. v0.2.1's manifest was published by hand this way.

CI (`ci.yml`: lint, build, unit and integration tests) runs on pushes and PRs to `main`, and can also be started by hand (`gh workflow run CI`).

## Architecture

```
addon/manifest.json              - plugin metadata, strict_min/max_version
addon/bootstrap.js                - startup/shutdown/install/uninstall lifecycle
addon/content/preferences.xhtml   - preferences pane markup (enable, external-lookups toggle, API key field)
addon/prefs.js                    - preference defaults
addon/locale/en-US/*.ftl          - Fluent strings
src/index.ts                      - bootstrap entry, lifecycle wiring
src/hooks.ts                      - lifecycle dispatch; registers the preferences pane; reader-tab notifier registration
src/modules/popupObserver.ts      - detects the native citation popup, reads reference text per row, orchestrates resolution (local -> cache -> Crossref -> Semantic Scholar) into a LookupReport
src/modules/referenceParser.ts    - pure: parses a reference string into {authors, year, title, doi}
src/modules/libraryResolver.ts    - local lookup in My Library, then each group library (DOI, then exact title/creator search, then fuzzy title match) -> LibraryStatus: found / notInLibrary / noAbstract / error
src/modules/crossref.ts           - Crossref fallback lookup (DOI, then bibliographic search on title or whole reference text)
src/modules/semanticScholar.ts    - Semantic Scholar fallback lookup, shared ~1.1s request spacing, retry/backoff on 429/5xx, optional API key
src/modules/titleMatch.ts         - pure: fuzzy title matching for the local fallback (compacted-title Dice similarity, author guard), firstAuthorLastName
src/modules/lookupResult.ts       - pure: LookupResult (found / missing+detail / error+HttpFailure), classifyFailure, combineResults, extractFailureDetails
src/modules/lookupReport.ts       - pure: LookupReport -> popup heading + per-source status lines (formatReport); combineLibraryStatuses
src/modules/textUtils.ts          - pure: stripXmlTags (JATS-XML), normalizeText
src/modules/abstractCache.ts      - in-memory cache of external results keyed by DOI or raw text; hits 24h, misses 1h, errors never; cleared on pref change
src/modules/popupInjector.ts      - appends the formatted report into a specific .reference-row
src/utils/prefs.ts                - typed Zotero.Prefs get/set/clear wrappers
test/unit/                        - offline unit tests for the pure modules above
test/startup.test.ts              - Zotero-integration test
```

`popupObserver.ts` is the orchestrator: for each `.reference-row` in a detected `.citation-popup`, it checks `libraryResolver` (never cached), then (only if `enableExternalLookups` is on) the cache, then `crossref`, then `semanticScholar`. Each source's result goes into a `LookupReport`, which `lookupReport.formatReport` turns into the text `popupInjector` shows. Every hover logs a one-line summary (`lookup report for "...": library=... crossref=... semanticScholar=...`) — the fastest way to diagnose a user report.

## Key gotchas discovered building this (don't rediscover these)

- **No hover-detection needed at all.** Zotero's reader has had a native citation-hover popup since v7 — hovering `[12]` (or a grouped `[27, 33]`) already shows the resolved reference(s). This plugin just observes that popup rather than reimplementing citation-marker parsing/hover detection from scratch.
- **The popup lives in `reader._iframeWindow.document`** (the outer reader wrapper), not the inner PDF content iframe (`_internalReader._primaryView._iframeWindow`, which only has PDF.js's own highlight overlays) and not the XUL popupset. Class `citation-popup`; a grouped citation renders **multiple** `.reference-row` elements in one popup — `querySelectorAll`, not `querySelector`, or you silently drop everything but the first.
- **No global `MutationObserver` (or other DOM APIs) in the bootstrap scope.** This bundle runs in a privileged sandbox, not a web page. Get `MutationObserver` off the target window (`reader._iframeWindow.MutationObserver`), not as a bare global.
- **Preferences pane needs explicit registration.** `Zotero.PreferencePanes.register({ pluginID, src, label })` in `onStartup` — without it, `preferences.xhtml` serves fine over `chrome://` but Zotero never surfaces a way to open it. The pane then lives in **Zotero's own Settings window** (app menu → Settings), _not_ Tools → Plugins (that's Firefox's generic Add-ons Manager and has no knowledge of it).
- **PDF tabs restored at startup are added as `reader-unloaded`** and only become `reader` when the PDF loads, via a `load` tab-notifier event (not `add`/`select`) - after the plugin's own startup, so `Zotero.Reader._readers` doesn't have them yet either. `hooks.ts` listens for `load` too. Tab `close` events pass IDs nested (`ids = [[id, ...]]`).
- **A failing `onShutdown` makes updates/reloads silently keep the old code.** `index.ts` only creates a new instance if `Zotero[addonInstance]` is gone, so if shutdown throws before its final `delete`, the next startup re-runs the _old_ instance's hooks. Every shutdown step is individually guarded for this reason; `MutationObserver.disconnect()` on a closed tab's window throws "can't access dead object". The startup log line `starting (code loaded at ...)` shows which copy is running.
- **Item fields are lazy-loaded per library.** An item from a library the user hasn't browsed this session (typically a group) throws "Item data not loaded and field ... not set" on `getField()` - call `await item.loadDataType("itemData")` first (see `libraryResolver.ts`).
- **`Zotero.HTTP.request` has its own built-in retry-on-error.** Pass `errorDelayMax: 0` when implementing custom retry logic, or the two stack and multiply actual requests sent.
- **`Zotero.Promise.delay()`** works for sleep/delay (used for backoff) despite `zotero-types` not declaring it — needs an `as any` cast, documented inline where used.
- **Crossref abstract coverage is genuinely inconsistent** (many ACM papers have none - confirmed, not a bug). **Semantic Scholar has better CS coverage but a much stricter unauthenticated rate limit** — a free per-user API key (entered in the plugin's own preferences, never baked into the build) fixes this; see the "why per-user not a shared embedded key" note in the preferences field/README.

- **HTTP/2 responses have an empty `statusText`** (Semantic Scholar's 403 arrives like this) - `lookupReport.ts` fills in standard reason phrases for common codes.
- **A Semantic Scholar API key's default limit is 1 request/second**, across all endpoints - hence the shared request spacing in `semanticScholar.ts`. A 403 means the key itself is rejected (e.g. truncated when pasted - real keys have a short prefix before a dash), not a rate limit.
- **The dev profile's data directory is currently `~/Zotero` - the real library**, since `.env`'s `ZOTERO_PLUGIN_DATA_DIR` is empty. The plugin only reads the library so this is safe today, but a separate data dir would be cleaner.

## Known open items / possible next steps

- The HTTP request/retry control flow in `crossref.ts`/`semanticScholar.ts` isn't unit-tested (would need mocking `Zotero.HTTP.request`) — only the pure helpers (URL builders, status classification, text normalization) are.
- No CHANGELOG.md; release notes currently live only on GitHub Releases.
- From repo creation (2026-09-21) until 2026-09-28, no event-triggered workflow ever ran: pushes, tag pushes, Dependabot PRs and the Issue Bot cron. Every CI and Issue Bot `run_number` started at 1 on 2026-09-28, so no runs had been deleted. The workflow files were valid and unchanged, the same `ci.yml` passed once it ran, and the `gh` token had the `repo` and `workflow` scopes. Triggers started working right after the first manual `workflow_dispatch` (Issue Bot). If CI/Release silently stop again, try `gh workflow run CI` first. Also check whether the Issue Bot cron (01:30 UTC daily) has been producing `schedule` runs.
- Dependabot: minor/patch bumps arrive as one weekly `all-non-major` PR, security updates as one `security` PR, and each major bump as its own PR. All 36 alerts were cleared on 2026-09-29 (v0.3.2). TypeScript 7 is on hold: typescript-eslint (via `@zotero-plugin/eslint-config`) only supports `typescript <6.1`, and eslint crashes on TS 7, so re-check this before merging a TS 7 PR.
- `zotero-plugin-toolkit` is a runtime dependency (bundled into the `.xpi`), unlike everything else Dependabot bumps. Since 5.2.0 `ZoteroToolkit` must be imported from `zotero-plugin-toolkit/ztoolkit`. After a toolkit bump, live-test with `npm run start`: hover a citation, toggle the online-lookup setting, close a PDF tab, and trigger a hot reload.
- `createZToolkit()` is called twice (`addon.ts` and `hooks.ts` `onMainWindowLoad`), each building a full `ZoteroToolkit`, so its field hooks get patched twice per startup. That's leftover template code, harmless so far; a single instance, or the minimal `MyToolkit` in `utils/ztoolkit.ts`, would be cleaner.
- `doc/` holds the upstream template's README translations (not about this plugin, unreferenced) and is excluded from prettier. They're candidates for deletion.
