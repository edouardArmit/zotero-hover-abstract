import { assert } from "chai";
import {
  classifyFailure,
  combineResults,
  extractFailureDetails,
  failureResult,
  NO_ABSTRACT,
  NO_MATCH,
  NO_QUERY,
  recordResult,
  type LookupResult,
} from "../../src/modules/lookupResult";

const found = (abstract: string): LookupResult => ({ kind: "found", abstract });
const authError: LookupResult = {
  kind: "error",
  failure: { reason: "auth", status: 403 },
};
const networkError: LookupResult = {
  kind: "error",
  failure: { reason: "network" },
};

describe("lookupResult", function () {
  describe("classifyFailure", function () {
    it("treats 404 and 400 as a definitive miss", function () {
      assert.equal(classifyFailure(404), "missing");
      assert.equal(classifyFailure(400), "missing");
    });

    it("treats 401 and 403 as a rejected API key", function () {
      assert.equal(classifyFailure(401), "auth");
      assert.equal(classifyFailure(403), "auth");
    });

    it("treats 429 as rate limited", function () {
      assert.equal(classifyFailure(429), "rateLimited");
    });

    it("treats 5xx and other unexpected statuses as a server error", function () {
      assert.equal(classifyFailure(503), "server");
      assert.equal(classifyFailure(418), "server");
    });

    it("treats no status (or 0) as a network issue", function () {
      assert.equal(classifyFailure(undefined), "network");
      assert.equal(classifyFailure(0), "network");
    });
  });

  describe("failureResult", function () {
    it("turns a 404 into a no-match miss", function () {
      assert.deepEqual(failureResult({ status: 404 }), NO_MATCH);
    });

    it("keeps the HTTP details on an error", function () {
      assert.deepEqual(
        failureResult({ status: 429, statusText: "Too Many Requests" }),
        {
          kind: "error",
          failure: {
            reason: "rateLimited",
            status: 429,
            statusText: "Too Many Requests",
          },
        },
      );
    });
  });

  describe("recordResult", function () {
    it("is found when there's an abstract", function () {
      assert.deepEqual(recordResult(true, "text"), found("text"));
    });

    it("distinguishes a record without an abstract from no record", function () {
      assert.deepEqual(recordResult(true, undefined), NO_ABSTRACT);
      assert.deepEqual(recordResult(false, undefined), NO_MATCH);
    });
  });

  describe("combineResults", function () {
    it("returns the first hit, even alongside errors", function () {
      assert.deepEqual(
        combineResults(networkError, found("A"), found("B")),
        found("A"),
      );
    });

    it("prefers an auth error over other errors", function () {
      assert.deepEqual(combineResults(networkError, authError), authError);
    });

    it("prefers any error over a miss, so it isn't cached", function () {
      assert.deepEqual(combineResults(NO_ABSTRACT, networkError), networkError);
    });

    it("prefers 'record has no abstract' over 'no record'", function () {
      assert.deepEqual(combineResults(NO_MATCH, NO_ABSTRACT), NO_ABSTRACT);
    });

    it("prefers a no-match over a skipped search", function () {
      assert.deepEqual(combineResults(NO_QUERY, NO_MATCH), NO_MATCH);
    });

    it("falls back to no-query when there's nothing at all", function () {
      assert.deepEqual(combineResults(), NO_QUERY);
      assert.deepEqual(combineResults(NO_QUERY), NO_QUERY);
    });
  });

  describe("extractFailureDetails", function () {
    it("reads status, status text and a JSON body message off the XHR", function () {
      assert.deepEqual(
        extractFailureDetails({
          status: 429,
          message: "HTTP request to https://... rejected with status 429",
          xmlhttp: {
            status: 429,
            statusText: "Too Many Requests",
            response: { message: "Please wait and try again." },
          },
        }),
        {
          status: 429,
          statusText: "Too Many Requests",
          message: "Please wait and try again.",
        },
      );
    });

    it("doesn't use the verbose exception message when there was a status", function () {
      const details = extractFailureDetails({
        status: 503,
        message: "HTTP request to https://... rejected with status 503",
        xmlhttp: { status: 503, statusText: "", response: null },
      });
      assert.deepEqual(details, {
        status: 503,
        statusText: undefined,
        message: undefined,
      });
    });

    it("uses the exception message when there was no response at all", function () {
      assert.deepEqual(
        extractFailureDetails({
          message: "Request timed out",
          xmlhttp: { status: 0 },
        }),
        {
          status: undefined,
          statusText: undefined,
          message: "Request timed out",
        },
      );
    });

    it("copes with a non-object error", function () {
      assert.deepEqual(extractFailureDetails(undefined), {
        status: undefined,
        statusText: undefined,
        message: undefined,
      });
    });
  });
});
