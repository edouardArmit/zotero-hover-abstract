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

| #   | Hover (in PDF A)                                            | Library setup                                                                                                   | Expected, online off                                                            | Expected, online on                                                            |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | [35] Parker 2017, How do you feel: Affective expressions... | My Library copy: abstract `[test] Parker - My Library copy`. Group copy: abstract `[test] Parker - group copy`. | Shows `[test] Parker - My Library copy` (My Library is searched first)          | Same, no online lookup                                                         |
| 2   | [51] Vanhanen, Lehtinen & Lassenius 2018                    | **Group only**, abstract `[test] Vanhanen - group only`                                                         | Shows `[test] Vanhanen - group only`                                            | Same, no online lookup                                                         |
| 3   | [9] Braun & Clarke 2012, Thematic analysis                  | My Library copy with **empty** abstract. Group copy: abstract `[test] Braun - group copy`.                      | Shows `[test] Braun - group copy` (a copy with an abstract beats one without)   | Same                                                                           |
| 4   | [48] Shakil & Denny 2024                                    | My Library, **only** in subcollection `sub`, abstract `[test] Shakil - subcollection`                           | Shows `[test] Shakil - subcollection`                                           | Same                                                                           |
| 5   | [31] Magana et al. 2023                                     | Not in any library                                                                                              | "No abstract found", library: not in your library                               | Crossref: no abstract. Semantic Scholar: found, heading names Semantic Scholar |
| 6   | [45] Rubino 2024 (thesis)                                   | Not in any library                                                                                              | "No abstract found"                                                             | Neither source has an abstract. **Hover again**: log line ends with `(cached)` |
| 7   | Pekrun 2006 (citing paper H), if A cites it                 | H lives in the group, with its real abstract                                                                    | Found, from the group (a My Library PDF citing a group item)                    | Same                                                                           |
| 8   | Any other reference in A (note which one)                   | My Library **and** group, both with empty abstracts                                                             | "No abstract" status for the library                                            | Online lookup runs (a library copy without an abstract doesn't stop it)        |
| 9   | Any other reference in A (note which one)                   | Only copy is **in the trash**                                                                                   | Expected: not in library (unverified: check whether trashed items are excluded) | Online lookup runs                                                             |
| 10  | The grouped citation covering [31], [35], [48]              | As above                                                                                                        | Three rows, each with its own result (rows 5, 1, 4)                             | Same, per row                                                                  |

## Cross-citations inside the set

Citing papers that cite each other test lookups across libraries with real
data. Confirm each on the first run and replace "likely" with the reference
number.

| #   | Hover                                                                         | Cited paper lives in | Expected                                            |
| --- | ----------------------------------------------------------------------------- | -------------------- | --------------------------------------------------- |
| 11  | In B (group), a reference that's in My Library only, e.g. one of C-L it cites | My Library           | Found. A PDF in the group can use My Library items. |
| 12  | In J (My Library), Kasneci et al. 2023 (likely)                               | My Library (I)       | Found                                               |
| 13  | In C (My Library), Luxton-Reilly et al. 2018 (likely)                         | My Library (D)       | Found                                               |
| 14  | In M (group), Prather et al. or Denny et al. papers (likely)                  | My Library (C)       | Found                                               |

## Parser and PDF-text cases

| #   | Hover                                                                                                          | Expected                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 15  | In H, I or J: an author-year citation such as "(Pekrun, 2006)"                                                 | Unverified whether Zotero's own popup appears for author-year styles. Record what happens. |
| 16  | In D: a reference authored by "Simon" (single name)                                                            | Parsed without dropping the author                                                         |
| 17  | Any reference whose title in the PDF text lost a hyphen at a line break, or has a ligature (fi, fl) or accents | Found in the library through the fuzzy title match                                         |
| 18  | A reference with "et al." in its author list                                                                   | Parsed without an author called "al."                                                      |

## Lifecycle checks

Run with `npm run start`. Log lines appear in the dev Zotero's console and in
`.scaffold/logs/`.

- [ ] Startup logs `[Zotero Hover Abstract] [hoverabstract] starting (code loaded at ...)`.
- [ ] Settings (app menu > Settings) shows the _Zotero Hover Abstract_ pane.
- [ ] Changing a plugin setting (the online toggle or the API key) takes effect on the next hover and clears the cache: a previously `(cached)` reference is fetched again.
- [ ] Opening K (216 pages) and hovering still works, with no long freeze.
- [ ] Closing a PDF tab logs no errors.
- [ ] Hot reload (save any file in `src/`) shows a new `code loaded at` time, and hovering still works.
- [ ] Quit and restart Zotero with a PDF tab open: once the restored tab loads, hovering works without reopening it.
