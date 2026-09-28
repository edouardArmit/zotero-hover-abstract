import { assert } from "chai";
import {
  clearAbstractCache,
  getCachedResults,
  setCachedResults,
} from "../../src/modules/abstractCache";
import type { ExternalResults } from "../../src/modules/lookupReport";
import { NO_ABSTRACT, NO_MATCH } from "../../src/modules/lookupResult";
import type { ParsedReference } from "../../src/modules/referenceParser";

// The cache is module-level singleton state; it's cleared before each test.
function fixture(overrides: Partial<ParsedReference> = {}): ParsedReference {
  return { raw: "some unique raw reference text", ...overrides };
}

const HOUR = 60 * 60 * 1000;
const hit: ExternalResults = {
  crossref: { kind: "found", abstract: "This is the abstract text." },
};
const miss: ExternalResults = {
  crossref: NO_ABSTRACT,
  semanticScholar: NO_MATCH,
};

describe("abstractCache", function () {
  beforeEach(clearAbstractCache);

  it("returns undefined for a reference that hasn't been cached yet", function () {
    assert.isUndefined(getCachedResults(fixture({ raw: "never looked up" })));
  });

  it("round-trips results along with when they were stored", function () {
    const parsed = fixture();
    setCachedResults(parsed, miss, 1000);
    assert.deepEqual(getCachedResults(parsed, 2000), {
      results: miss,
      storedAt: 1000,
    });
  });

  it("keys by DOI when present, ignoring differences in raw text", function () {
    setCachedResults(fixture({ raw: "version one", doi: "10.1234/x" }), hit);
    assert.deepEqual(
      getCachedResults(fixture({ raw: "version two", doi: "10.1234/x" }))
        ?.results,
      hit,
    );
  });

  it("keys by raw text when there's no DOI, so different references don't collide", function () {
    setCachedResults(fixture({ raw: "reference A" }), hit);
    assert.isUndefined(getCachedResults(fixture({ raw: "reference B" })));
  });

  it("expires a cached miss after an hour", function () {
    const parsed = fixture();
    setCachedResults(parsed, miss, 0);
    assert.isDefined(getCachedResults(parsed, HOUR - 1));
    assert.isUndefined(getCachedResults(parsed, HOUR + 1));
  });

  it("keeps a found abstract for a day, then expires it", function () {
    const parsed = fixture();
    setCachedResults(parsed, hit, 0);
    assert.isDefined(getCachedResults(parsed, 23 * HOUR));
    assert.isUndefined(getCachedResults(parsed, 25 * HOUR));
  });

  it("counts a Semantic Scholar hit as found for expiry", function () {
    const parsed = fixture();
    setCachedResults(
      parsed,
      { crossref: NO_MATCH, semanticScholar: { kind: "found", abstract: "A" } },
      0,
    );
    assert.isDefined(getCachedResults(parsed, 2 * HOUR));
  });

  it("clearAbstractCache drops everything", function () {
    const parsed = fixture();
    setCachedResults(parsed, hit);
    clearAbstractCache();
    assert.isUndefined(getCachedResults(parsed));
  });

  it("evicts the oldest entry once over capacity", function () {
    for (let i = 0; i <= 500; i++) {
      setCachedResults(fixture({ raw: `entry ${i}` }), hit);
    }
    assert.isUndefined(getCachedResults(fixture({ raw: "entry 0" })));
    assert.isDefined(getCachedResults(fixture({ raw: "entry 500" })));
  });
});
