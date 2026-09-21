import { assert } from "chai";
import { normalizeText, stripXmlTags } from "../../src/modules/textUtils";

describe("textUtils", function () {
  describe("stripXmlTags", function () {
    it("strips simple tags down to plain text", function () {
      assert.equal(
        stripXmlTags("<jats:p>Hello world.</jats:p>"),
        "Hello world.",
      );
    });

    it("collapses whitespace left behind by stripped tags and formatting", function () {
      assert.equal(
        stripXmlTags(
          "<jats:p>First sentence.</jats:p>  <jats:p>Second   sentence.</jats:p>",
        ),
        "First sentence. Second sentence.",
      );
    });

    it("handles nested tags", function () {
      assert.equal(
        stripXmlTags(
          "<jats:p>Text with <jats:italic>emphasis</jats:italic> in it.</jats:p>",
        ),
        "Text with emphasis in it.",
      );
    });

    it("returns undefined for undefined input", function () {
      assert.isUndefined(stripXmlTags(undefined));
    });

    it("returns undefined for an empty string", function () {
      assert.isUndefined(stripXmlTags(""));
    });

    it("returns undefined when the result is only whitespace/tags with no text", function () {
      assert.isUndefined(stripXmlTags("<jats:p>   </jats:p>"));
    });
  });

  describe("normalizeText", function () {
    it("trims surrounding whitespace", function () {
      assert.equal(normalizeText("  some text  "), "some text");
    });

    it("returns undefined for undefined input", function () {
      assert.isUndefined(normalizeText(undefined));
    });

    it("returns undefined for null input", function () {
      assert.isUndefined(normalizeText(null));
    });

    it("returns undefined for an empty string", function () {
      assert.isUndefined(normalizeText(""));
    });

    it("returns undefined for a whitespace-only string", function () {
      assert.isUndefined(normalizeText("   "));
    });

    it("leaves already-clean text unchanged", function () {
      assert.equal(normalizeText("Clean text."), "Clean text.");
    });
  });
});
