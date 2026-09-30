# Dev library test checklist

A manual end-to-end test against a small, purpose-built Zotero library,
meant for before each release and after any change to lookup logic or to
`zotero-plugin-toolkit` (the one dependency bundled into the `.xpi`).

**Never commit the test library itself**: no PDFs, no exported Zotero data,
no real abstracts. This file only lists what to set up and what to expect.

## Setup

1. **Separate data directory.** Create an empty folder outside the repo, e.g.
   `~/Zotero-dev`, and set `ZOTERO_PLUGIN_DATA_DIR` in `.env` to it. Don't
   leave it empty: an empty value falls back to your real `~/Zotero` library.
   Stop the dev Zotero by quitting it (Zotero > Quit), never by closing or
   killing its terminal, and quit your real Zotero before starting it.
2. **Sync.** In the dev profile, either keep sync off or sign in only to the
   **test** zotero.org account. Never sign in to your real account there, or
   a sync would pull your whole real library into the dev data directory.
3. **Libraries.**
   - _My Library_ holds most items, plus a collection `HoverAbstract test set`
     with a subcollection `sub`.
   - _Group library_ `HoverAbstract Test`, owned by the test account, holds the
     items marked "group" below.
4. **Building it.** In your real Zotero, collect the citing papers below and
   the cited papers used in the cases into one collection. Export it as
   Zotero RDF (with files) and import that into the dev profile. Then move
   items and adjust abstracts as listed below.
5. **Test abstracts.** Wherever an abstract is set by hand below, replace the
   real one with the `[test] ...` text given, so the popup shows which copy
   the plugin picked.

## Citing papers (the PDFs you open and hover in)

Picked semi-randomly from a real library to cover publishers, reference
styles, item types and reference-list sizes.

| ID  | Paper                                                                                                                            | Type, style                        | Why it's here                                               | Where                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| A   | Awan, Paasivaara & Gloor 2026. From Struggle to Success... ICSE-SEET. `10.1145/3786580.3786964`                                  | Conference, ACM numbered           | Baseline, results known from earlier testing                | My Library                      |
| B   | Felipe & Harland 2025. Scaffolding creative thinking in project-based learning... IEEE TALE. `10.1109/TALE66047.2025.11346649`   | Conference, IEEE numbered          | IEEE format; a citing PDF stored in the group               | group                           |
| C   | Prather et al. 2024. The Widening Gap... ICER. `10.1145/3632620.3671116`                                                         | Conference, ACM numbered           | Recent GenAI refs, some likely only on arXiv                | My Library                      |
| D   | Luxton-Reilly, Simon et al. 2018. Introductory programming: a systematic literature review. ITiCSE WG. `10.1145/3293881.3295779` | Working-group report, ACM numbered | Very long reference list; an author with one name ("Simon") | My Library                      |
| E   | Lishinski, Yadav & Enbody 2017. Students' Emotional Reactions to Programming Projects... ICER. `10.1145/3105726.3106187`         | Conference, ACM numbered           | Older ACM layout                                            | My Library                      |
| F   | Long & Magerko 2020. What is AI Literacy? CHI. `10.1145/3313831.3376727`                                                         | Conference, ACM (CHI) numbered     | HCI venue, interdisciplinary refs                           | My Library, subcollection `sub` |
| G   | Porter, Guzdial, McDowell & Simon 2013. Success in introductory programming: what works? CACM. `10.1145/2492007.2492020`         | Magazine, ACM                      | Very short, few references                                  | My Library                      |
| H   | Pekrun 2006. The Control-Value Theory of Achievement Emotions... Educ. Psychol. Rev. `10.1007/s10648-006-9029-9`                 | Journal, Springer, APA author-year | Author-year citations; older PDF; cited by A                | group                           |
| I   | Kasneci et al. 2023. ChatGPT for good? ... Learning and Individual Differences. `10.1016/j.lindif.2023.102274`                   | Journal, Elsevier, author-year     | 23 authors; Elsevier layout                                 | My Library                      |
| J   | Fan et al. 2025. Beware of metacognitive laziness... BJET. `10.1111/bjet.13544`                                                  | Journal, Wiley, APA author-year    | Wiley layout; likely cites I                                | My Library                      |
| K   | Kosmyna et al. 2025. Your Brain on ChatGPT... arXiv. `10.48550/arXiv.2506.08872`                                                 | Preprint (216 pages), numbered     | Huge PDF; arXiv layout                                      | My Library                      |
| L   | Bower et al. 2025. Creativity and creative thinking. In _Creative Technologies Education_, Routledge. `10.4324/9781003490715-3`  | Book chapter, Taylor & Francis     | Book-chapter layout                                         | My Library                      |
| M   | Liffiton et al. 2023. CodeHelp: Using Large Language Models with Guardrails... arXiv. `10.48550/arXiv.2308.06921`                | Preprint, ACM-style numbered       | Second citing PDF in the group                              | group                           |

**First run for each paper:** hover 3-5 references (at least one grouped
citation where the style has them) and add them to the tables below as new
rows with the observed result. After that, a changed result is either a
regression or an online source that changed, and the log line says which.

## Cases with controlled library contents (hover in A)

"Off" and "On" refer to the setting _Also check Crossref and Semantic
Scholar_. The online results were observed on 2026-09-29 and can change as
those services add abstracts.

**Semantic Scholar without an API key** shares one rate limit with every
anonymous user, so it can return 429 on every attempt, as it did on the
evening of 2026-09-29. The correct behaviour then is: retries after 1s, 2s and
4s, the popup shows a rate-limit status rather than "not found", and the
result is **not** cached (the next hover asks again). Rows 5 and 6 can only
show "found" and `(cached)` once Semantic Scholar answers, so enter a free API
key in the plugin's settings for a reliable run.

Verified on 2026-09-29 with online search off: rows 1-5 and 10. With it on:
row 5 in full (Semantic Scholar found [31] once its limit eased), the cache
(hovering [31] again logged `(cached)` with no network requests), library hits
skipping online search, and errors not being cached (the rate-limited [45]
asked again on every hover). With a Semantic Scholar API key: row 6 in full
([45] answered "no abstract", and hovering it again logged `(cached)` with no
network requests). Saving the key cleared the cache, so the next [31] hover
fetched again.

| #   | Hover (in PDF A)                                            | Library setup                                                                                                   | Expected, online off                                                          | Expected, online on                                                            |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | [35] Parker 2017, How do you feel: Affective expressions... | My Library copy: abstract `[test] Parker - My Library copy`. Group copy: abstract `[test] Parker - group copy`. | Shows `[test] Parker - My Library copy` (My Library is searched first)        | Same, no online lookup                                                         |
| 2   | [51] Vanhanen, Lehtinen & Lassenius 2018                    | **Group only**, abstract `[test] Vanhanen - group only`                                                         | Shows `[test] Vanhanen - group only`                                          | Same, no online lookup                                                         |
| 3   | [9] Braun & Clarke 2012, Thematic analysis                  | My Library copy with **empty** abstract. Group copy: abstract `[test] Braun - group copy`.                      | Shows `[test] Braun - group copy` (a copy with an abstract beats one without) | Same                                                                           |
| 4   | [48] Shakil & Denny 2024                                    | My Library, **only** in subcollection `sub`, abstract `[test] Shakil - subcollection`                           | Shows `[test] Shakil - subcollection`                                         | Same                                                                           |
| 5   | [31] Magana et al. 2023                                     | Not in any library                                                                                              | "No abstract found", library: not in your library                             | Crossref: no abstract. Semantic Scholar: found, heading names Semantic Scholar |
| 6   | [45] Rubino 2024 (thesis)                                   | Not in any library                                                                                              | "No abstract found"                                                           | Neither source has an abstract. **Hover again**: log line ends with `(cached)` |
| 7   | [36] Pekrun 2006 (citing paper H)                           | H lives in the group, with its real abstract                                                                    | Found, from the group (a My Library PDF citing a group item)                  | Same                                                                           |
| 8   | [15] Fredrickson 2001                                       | My Library **and** group, both with empty abstracts (DOI `10.1037/0003-066x.56.3.218`)                          | "in your library, but its abstract field is empty"                            | Online lookup still runs. **Verified 2026-09-30**                              |
| 9   | [49] Snyder 2002                                            | Abstract `[test] Snyder - in trash`. Hover once (found), then **Move to Trash** and hover again                 | Before: shows `[test] Snyder - in trash`. After: not in library               | Online lookup runs. **Verified 2026-09-30** (trashed items are ignored)        |
| 10  | The grouped citation covering [31], [35], [48]              | As above                                                                                                        | Three rows, each with its own result (rows 5, 1, 4)                           | Same, per row                                                                  |

**Parser finding (2026-09-30), fixed:** a title ending in `?` or `!` used to
run into the venue, because the parser ended titles only at `". "`. [47]
Scherer 2005 parsed as "What are emotions? And how can they be measured?
Social science information 44, 4 (2005), 695-729." and wasn't found in the
library. After the fix it parses as "What are emotions? And how can they be
measured?" and is found. Keep [47] as a regression check (DOI
`10.1177/0539018405058216`, in My Library, abstract `[test] Scherer - in trash`).

## Cross-citations inside the set

Citing papers that cite each other test lookups across libraries with real
data. These were found by searching each PDF's extracted text (the
`.zotero-ft-cache` file next to it in `storage/`) for the other items' titles.
Use Cmd+F on the quoted text to find the in-text marker, then hover it.

| #   | Open           | Find                                    | Hover                  | Cited paper lives in | Expected                    | 2026-09-30 |
| --- | -------------- | --------------------------------------- | ---------------------- | -------------------- | --------------------------- | ---------- |
| 11  | B (group)      | `creating visual artifacts`             | [25] Kasneci           | My Library (I)       | Found, "from your library"  | pass       |
| 12  | M (group)      | `[16]`                                  | [16] Kasneci           | My Library (I)       | Found, "from your library"  | pass       |
| 13  | C (My Library) | `CodeHelp [32]`                         | [32] Liffiton CodeHelp | group (M)            | Found, "from group library" | pass       |
| 14  | D (My Library) | `Notable qualitative studies`           | [279, 326, 376]        | My Library (E)       | [376] Lishinski found       | see below  |
| 14b | D (My Library) | `approaches that we know are effective` | [518] Porter           | My Library (G)       | Found                       | see below  |

Row 7 (A citing Pekrun [36], found in the group) also passed on 2026-09-30.

**Known limitation (rows 14, 14b):** in D, Zotero shows a preview of the
link's target page instead of its citation popup, for every citation tried
([45], [376], [518], [554], [672]). There's then no `.reference-row` for the
plugin to read, and no `parsed reference` line in the log. This comes from
Zotero's own reference detection, not the plugin. Investigated 2026-09-30 by
reading Zotero's reader code (`resource/reader/pdf/build/pdf.worker.mjs` in
`omni.ja`):

- Not the number of references: there's no cap in the code.
- Not the citation format: D uses numbered `[n]` like A, B, C and E, which
  work, and author-year (J) works too.
- Not the heading: D has exactly one "REFERENCES" past the halfway point, as
  required.
- Not the links: the preview shows the link target, and the entry is on it.
  Zotero discards a linked citation whose target page differs from the page
  where it found the entry.

What's left is Zotero failing to split D's reference list into entries or to
match them. Three-digit reference numbers aren't the cause either: F (150
numbered references) gets popups for [9], [55] and [124]. So the cause is
specific to D's layout. Possible future feature: when only a preview appears, read
the reference text at the link's target.

**K has no citation popups either** (tested [3] and [44]). K is an arXiv
preprint exported from Google Docs: its in-text `[n]` aren't internal links,
its list uses `1.` labels, and the "References" heading is on page 155 of 216,
followed by a long appendix. Zotero doesn't detect its references. Treat it as
a preprint-layout limitation. K is still useful for the big-PDF performance
check.

## Parser and PDF-text cases

| #   | Hover                                                                          | Expected                                                                                                                                      |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | In H, I or J: an author-year citation such as "(Pekrun, 2006)"                 | **Verified 2026-09-30:** Zotero's popup does appear for author-year styles (J, "Rane (2023)"), and the plugin handles it like a numbered one. |
| 16  | In C: [8] Busjahn, Schulte, Sharif, Simon, ... (search `novice gaze patterns`) | Parsed with "Simon" kept as an author. **Verified 2026-09-30**. (D was the original target but never gets popups, see above.)                 |
| 17  | In A: [48] Shakil & Denny, printed as "LargeScale" in the PDF                  | Found through the fuzzy title match (log: `fuzzy title match ... similarity 1.00`). **Verified 2026-09-30**                                   |
| 18  | A reference with "et al." in its author list                                   | Parsed without an author called "al."                                                                                                         |

## Lifecycle checks

All verified 2026-09-29/30 (restored tabs: C came back `reader-unloaded`, loaded
when clicked, and hovering worked straight away).

Run with `npm run start`. Log lines appear in the dev Zotero's console and in
`.scaffold/logs/`.

- [ ] Startup logs `[Zotero Hover Abstract] [hoverabstract] starting (code loaded at ...)`.
- [ ] Settings (app menu > Settings) shows the _Zotero Hover Abstract_ pane.
- [ ] Changing a plugin setting (the online toggle or the API key) takes effect on the next hover and clears the cache: a previously `(cached)` reference is fetched again.
- [ ] Opening K (216 pages) takes a few seconds to search and jump, with no freeze. (Its citations get no popups, see above.)
- [ ] Closing a PDF tab logs no errors.
- [ ] Hot reload (save any file in `src/`) shows a new `code loaded at` time, and hovering still works.
- [ ] Quit and restart Zotero with a PDF tab open: once the restored tab loads, hovering works without reopening it.
