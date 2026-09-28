import { assert } from "chai";
import {
  combineLibraryStatuses,
  formatAge,
  formatHttpError,
  formatReport,
  type FormatOptions,
  type LookupReport,
} from "../../src/modules/lookupReport";
import {
  NO_ABSTRACT,
  NO_MATCH,
  NO_QUERY,
  type LookupResult,
} from "../../src/modules/lookupResult";

const MIN = 60 * 1000;
const options: FormatOptions = {
  settingsName: "My Plugin",
  now: 100 * MIN,
  showCacheAge: false,
};
const notInLibrary = { kind: "notInLibrary" } as const;
const error = (
  reason: "auth" | "rateLimited" | "server" | "network",
  extra: object = {},
): LookupResult => ({ kind: "error", failure: { reason, ...extra } });

function format(report: LookupReport, overrides: Partial<FormatOptions> = {}) {
  return formatReport(report, { ...options, ...overrides });
}

describe("lookupReport", function () {
  describe("formatReport - found", function () {
    it("labels an abstract from the library, with no status lines", function () {
      const result = format({
        library: { kind: "found", abstract: "Local." },
        external: "disabled",
      });
      assert.deepEqual(result, {
        heading: "Abstract (from your library)",
        abstract: "Local.",
        details: [],
      });
    });

    it("names the group library an abstract came from", function () {
      const result = format({
        library: { kind: "found", abstract: "Group.", groupName: "Lab" },
        external: "disabled",
      });
      assert.equal(result.heading, 'Abstract (from group library "Lab")');
    });

    it("labels an abstract from Crossref", function () {
      const result = format({
        library: notInLibrary,
        external: { crossref: { kind: "found", abstract: "CR." } },
      });
      assert.equal(result.heading, "Abstract (from Crossref)");
      assert.equal(result.abstract, "CR.");
    });

    it("labels an abstract from Semantic Scholar after a Crossref miss", function () {
      const result = format({
        library: notInLibrary,
        external: {
          crossref: NO_ABSTRACT,
          semanticScholar: { kind: "found", abstract: "S2." },
        },
      });
      assert.equal(result.heading, "Abstract (from Semantic Scholar)");
      assert.deepEqual(result.details, []);
    });
  });

  describe("formatReport - not found", function () {
    it("says online search is off and where to turn it on", function () {
      const result = format({ library: notInLibrary, external: "disabled" });
      assert.deepEqual(result, {
        heading: "No abstract found",
        details: [
          "Library: not in your library or group libraries",
          "Online search: off (turn it on in Settings > My Plugin)",
        ],
      });
    });

    it("distinguishes an in-library item with an empty abstract", function () {
      const result = format({
        library: { kind: "noAbstract" },
        external: "disabled",
      });
      assert.equal(
        result.details[0],
        "Library: in your library, but its abstract field is empty",
      );
    });

    it("names the group library holding a copy with an empty abstract", function () {
      const result = format({
        library: { kind: "noAbstract", groupName: "Lab" },
        external: "disabled",
      });
      assert.equal(
        result.details[0],
        'Library: in group library "Lab", but its abstract field is empty',
      );
    });

    it("reports a failed library search", function () {
      const result = format({
        library: { kind: "error", message: "boom" },
        external: "disabled",
      });
      assert.equal(result.details[0], "Library: search failed (boom)");
    });

    it("gives one line per external source", function () {
      const result = format({
        library: notInLibrary,
        external: { crossref: NO_ABSTRACT, semanticScholar: NO_MATCH },
      });
      assert.deepEqual(result.details, [
        "Library: not in your library or group libraries",
        "Crossref: record found, but no abstract available",
        "Semantic Scholar: no matching record",
      ]);
    });

    it("explains a search that couldn't be run", function () {
      const result = format({
        library: notInLibrary,
        external: { crossref: NO_MATCH, semanticScholar: NO_QUERY },
      });
      assert.equal(
        result.details[2],
        "Semantic Scholar: not searched (no title or DOI could be read from the reference)",
      );
    });

    it("shows an auth error with its status and where to fix the key", function () {
      const result = format({
        library: notInLibrary,
        external: {
          crossref: NO_MATCH,
          semanticScholar: error("auth", {
            status: 403,
            statusText: "Forbidden",
            message: "Forbidden",
          }),
        },
      });
      assert.equal(
        result.details[2],
        "Semantic Scholar: authentication error, 403 Forbidden - check the API key in Settings > My Plugin",
      );
    });

    it("shows a rate limit with the service's own message", function () {
      const result = format({
        library: notInLibrary,
        external: {
          crossref: NO_MATCH,
          semanticScholar: error("rateLimited", {
            status: 429,
            statusText: "Too Many Requests",
            message: "Please wait and try again.",
          }),
        },
      });
      assert.equal(
        result.details[2],
        'Semantic Scholar: rate limited, 429 Too Many Requests: "Please wait and try again." - hover again later',
      );
    });

    it("shows a server error and a network issue on separate sources", function () {
      const result = format({
        library: notInLibrary,
        external: {
          crossref: error("network", { message: "Request timed out" }),
          semanticScholar: error("server", { status: 503 }),
        },
      });
      assert.deepEqual(result.details.slice(1), [
        "Crossref: network issue (Request timed out) - hover again to retry",
        "Semantic Scholar: server error, 503 Service Unavailable - hover again later",
      ]);
    });
  });

  describe("formatReport - cache age", function () {
    const cached: LookupReport = {
      library: notInLibrary,
      external: { crossref: { kind: "found", abstract: "CR." } },
      cachedAt: 88 * MIN,
    };

    it("appends the cache age when enabled (development builds)", function () {
      assert.equal(
        format(cached, { showCacheAge: true }).heading,
        "Abstract (from Crossref) · cached 12 min ago",
      );
    });

    it("hides the cache age otherwise", function () {
      assert.equal(format(cached).heading, "Abstract (from Crossref)");
    });

    it("doesn't mention the cache for a fresh result", function () {
      const fresh = { ...cached, cachedAt: undefined };
      assert.equal(
        format(fresh, { showCacheAge: true }).heading,
        "Abstract (from Crossref)",
      );
    });
  });

  describe("combineLibraryStatuses", function () {
    const found = (groupName?: string) =>
      ({ kind: "found", abstract: "A.", groupName }) as const;
    const empty = (groupName?: string) =>
      ({ kind: "noAbstract", groupName }) as const;
    const failed = { kind: "error", message: "boom" } as const;

    it("takes the first copy with an abstract, even after an empty one", function () {
      assert.deepEqual(
        combineLibraryStatuses([empty(), notInLibrary, found("Lab")]),
        found("Lab"),
      );
    });

    it("prefers My Library's copy when both have an abstract", function () {
      assert.deepEqual(
        combineLibraryStatuses([found(), found("Lab")]),
        found(),
      );
    });

    it("reports an empty-abstract copy over an error or no match", function () {
      assert.deepEqual(
        combineLibraryStatuses([failed, notInLibrary, empty("Lab")]),
        empty("Lab"),
      );
    });

    it("reports an error rather than 'not found' if a library couldn't be searched", function () {
      assert.deepEqual(combineLibraryStatuses([notInLibrary, failed]), failed);
    });

    it("is not found when no library has it, or there are none", function () {
      assert.deepEqual(
        combineLibraryStatuses([notInLibrary, notInLibrary]),
        notInLibrary,
      );
      assert.deepEqual(combineLibraryStatuses([]), notInLibrary);
    });
  });

  describe("formatHttpError", function () {
    it("drops a body message that just repeats the status text", function () {
      assert.equal(
        formatHttpError({
          reason: "auth",
          status: 403,
          statusText: "Forbidden",
          message: "forbidden",
        }),
        "403 Forbidden",
      );
    });

    it("fills in a missing status text, so a matching body message is dropped", function () {
      assert.equal(
        formatHttpError({ reason: "auth", status: 403, message: "Forbidden" }),
        "403 Forbidden",
      );
    });

    it("truncates a long message", function () {
      const text = formatHttpError({
        reason: "server",
        status: 500,
        message: "x".repeat(200),
      });
      assert.isTrue(text.startsWith(`500 Internal Server Error: "`));
      assert.isAtMost(text.length, `500 Internal Server Error: ""`.length + 90);
      assert.isTrue(text.endsWith('…"'));
    });

    it("says so when there's nothing at all", function () {
      assert.equal(formatHttpError({ reason: "server" }), "no status");
    });
  });

  describe("formatAge", function () {
    it("formats seconds, minutes and hours", function () {
      assert.equal(formatAge(30 * 1000), "just now");
      assert.equal(formatAge(12 * MIN), "12 min ago");
      assert.equal(formatAge(3 * 60 * MIN), "3 h ago");
    });
  });
});
