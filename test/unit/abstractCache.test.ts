import { assert } from "chai";
import {
  getCachedAbstract,
  setCachedAbstract,
} from "../../src/modules/abstractCache";
import type { ParsedReference } from "../../src/modules/referenceParser";

// The cache is module-level singleton state, so each test uses a distinct
// `raw`/`doi` fixture to avoid cross-test interference rather than relying
// on any reset between tests (no such reset is exposed, deliberately - it's
// meant to live for the whole plugin session).
function fixture(overrides: Partial<ParsedReference> = {}): ParsedReference {
  return { raw: "some unique raw reference text", ...overrides };
}

describe("abstractCache", function () {
  it("returns undefined for a reference that hasn't been cached yet", function () {
    const parsed = fixture({ raw: "never looked up before" });
    assert.isUndefined(getCachedAbstract(parsed));
  });

  it("round-trips a found abstract", function () {
    const parsed = fixture({ raw: "reference with a found abstract" });
    setCachedAbstract(parsed, "This is the abstract text.");
    assert.equal(getCachedAbstract(parsed), "This is the abstract text.");
  });

  it("caches a confirmed miss as null, distinct from undefined", function () {
    const parsed = fixture({ raw: "reference with a confirmed miss" });
    setCachedAbstract(parsed, null);
    assert.isNull(getCachedAbstract(parsed));
  });

  it("keys by DOI when present, ignoring differences in raw text", function () {
    const first = fixture({
      raw: "raw text version one",
      doi: "10.1234/shared-doi",
    });
    const second = fixture({
      raw: "completely different raw text",
      doi: "10.1234/shared-doi",
    });

    setCachedAbstract(first, "Found via the first lookup.");
    assert.equal(getCachedAbstract(second), "Found via the first lookup.");
  });

  it("keys by raw text when there's no DOI, so different references don't collide", function () {
    const first = fixture({ raw: "reference A, no doi" });
    const second = fixture({ raw: "reference B, no doi" });

    setCachedAbstract(first, "Abstract for A.");
    assert.isUndefined(getCachedAbstract(second));
  });
});
