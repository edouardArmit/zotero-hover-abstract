import { assert } from "chai";
import {
  buildDoiUrl,
  buildTitleSearchUrl,
  getStatus,
  isThrottledStatus,
} from "../../src/modules/semanticScholar";

describe("semanticScholar", function () {
  describe("buildDoiUrl", function () {
    it("builds a paper-by-DOI URL requesting the abstract field", function () {
      assert.equal(
        buildDoiUrl("10.1145/3287324.3287371"),
        "https://api.semanticscholar.org/graph/v1/paper/DOI:10.1145%2F3287324.3287371?fields=abstract",
      );
    });

    it("encodes special characters in the DOI, e.g. parentheses", function () {
      assert.equal(
        buildDoiUrl("10.1016/0749-5978(91)90022-L"),
        "https://api.semanticscholar.org/graph/v1/paper/DOI:10.1016%2F0749-5978(91)90022-L?fields=abstract",
      );
    });
  });

  describe("buildTitleSearchUrl", function () {
    it("builds a search URL requesting title and abstract, limited to one result", function () {
      const url = buildTitleSearchUrl("A Great Paper");
      assert.include(
        url,
        "https://api.semanticscholar.org/graph/v1/paper/search?",
      );
      assert.include(url, "query=A%20Great%20Paper");
      assert.include(url, "fields=title,abstract");
      assert.include(url, "limit=1");
    });

    it("URL-encodes special characters in the title", function () {
      const url = buildTitleSearchUrl("Fish & Chips: A Study");
      assert.include(url, "query=Fish%20%26%20Chips%3A%20A%20Study");
    });
  });

  describe("getStatus", function () {
    it("reads status directly off the error", function () {
      assert.equal(getStatus({ status: 429 }), 429);
    });

    it("falls back to status on a nested xmlhttp object", function () {
      assert.equal(getStatus({ xmlhttp: { status: 500 } }), 500);
    });

    it("prefers a direct status over a nested xmlhttp one", function () {
      assert.equal(getStatus({ status: 429, xmlhttp: { status: 500 } }), 429);
    });

    it("returns undefined when neither is present", function () {
      assert.isUndefined(getStatus({}));
      assert.isUndefined(getStatus(undefined));
      assert.isUndefined(getStatus(null));
    });
  });

  describe("isThrottledStatus", function () {
    it("treats 429 as throttled", function () {
      assert.isTrue(isThrottledStatus(429));
    });

    it("treats any 5xx as throttled", function () {
      assert.isTrue(isThrottledStatus(500));
      assert.isTrue(isThrottledStatus(503));
      assert.isTrue(isThrottledStatus(599));
    });

    it("does not treat 4xx other than 429 as throttled", function () {
      assert.isFalse(isThrottledStatus(400));
      assert.isFalse(isThrottledStatus(404));
    });

    it("does not treat success codes as throttled", function () {
      assert.isFalse(isThrottledStatus(200));
    });

    it("does not treat a missing status as throttled", function () {
      assert.isFalse(isThrottledStatus(undefined));
    });
  });
});
