import { assert } from "chai";
import {
  buildBibliographicQueryUrl,
  buildDoiUrl,
} from "../../src/modules/crossref";

describe("crossref", function () {
  describe("buildDoiUrl", function () {
    it("builds a works-by-DOI URL", function () {
      assert.equal(
        buildDoiUrl("10.1145/3287324.3287371"),
        "https://api.crossref.org/works/10.1145%2F3287324.3287371",
      );
    });

    it("encodes special characters in the DOI, e.g. parentheses", function () {
      assert.equal(
        buildDoiUrl("10.1016/0749-5978(91)90022-L"),
        "https://api.crossref.org/works/10.1016%2F0749-5978(91)90022-L",
      );
    });
  });

  describe("buildBibliographicQueryUrl", function () {
    it("combines title and authors into the query", function () {
      const url = buildBibliographicQueryUrl("A Great Paper", "Jane Doe");
      assert.include(url, "query.bibliographic=A%20Great%20Paper%20Jane%20Doe");
      assert.include(url, "rows=1");
    });

    it("omits authors from the query when not provided", function () {
      const url = buildBibliographicQueryUrl("A Great Paper", undefined);
      assert.include(url, "query.bibliographic=A%20Great%20Paper");
      assert.notInclude(url, "undefined");
    });

    it("URL-encodes an unescaped ampersand in the title so it can't be mistaken for a query-parameter separator", function () {
      const url = buildBibliographicQueryUrl("Fish & Chips", undefined);
      const queryParam = url.split("&rows=1")[0];
      assert.notInclude(queryParam, "&"); // a literal & here would split into an extra param
      assert.include(queryParam, "Fish%20%26%20Chips");
    });
  });
});
