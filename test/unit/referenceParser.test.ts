import { assert } from "chai";
import { parseReferenceText } from "../../src/modules/referenceParser";

describe("parseReferenceText", function () {
  it("parses an ACM-style reference with a DOI", function () {
    const result = parseReferenceText(
      "[28] Andrew Luxton-Reilly, Simon, Ibrahim Albluwi, Brett A. Becker, Michail Giannakos, Amruth N. Kumar, Linda Ott, James Paterson, Michael James Scott, Judy Sheard, and Claudia Szabo. 2018. Introductory Programming: A Systematic Literature Review. In Proceedings of the 50th ACM Technical Symposium on Computer Science Education (SIGCSE ’19). ACM, New York, NY, USA, 469–475. https://doi.org/10.1145/3287324.3287371",
    );

    assert.equal(
      result.authors,
      "Andrew Luxton-Reilly, Simon, Ibrahim Albluwi, Brett A. Becker, Michail Giannakos, Amruth N. Kumar, Linda Ott, James Paterson, Michael James Scott, Judy Sheard, and Claudia Szabo",
    );
    assert.equal(result.year, "2018");
    assert.equal(
      result.title,
      "Introductory Programming: A Systematic Literature Review",
    );
    assert.equal(result.doi, "10.1145/3287324.3287371");
  });

  it("parses an ACM-style reference with no DOI", function () {
    const result = parseReferenceText(
      "[21] Marietjie Havenga, Elsa Mentz, and R De Villiers. 2011. Thinking processes used by high-performing students in a computer programming task. TD: The Journal for Transdisciplinary Research in Southern Africa 7, 1 (2011), 25–40.",
    );

    assert.equal(
      result.authors,
      "Marietjie Havenga, Elsa Mentz, and R De Villiers",
    );
    assert.equal(result.year, "2011");
    assert.equal(
      result.title,
      "Thinking processes used by high-performing students in a computer programming task",
    );
    assert.isUndefined(result.doi);
  });

  it("normalizes a DOI written with a doi.org URL prefix", function () {
    const result = parseReferenceText(
      "[27] Dastyni Loksa, Amy J Ko, Will Jernigan, Alannah Oleson, Christopher J Mendez, and Margaret M Burnett. 2016. Programming, Problem Solving, and SelfAwareness: Effects of Explicit Guidance. In Proceedings of the 2016 CHI Conference on Human Factors in Computing Systems. ACM, 1449–1461. https://doi.org/10.1145/2858036.2858252",
    );

    assert.equal(result.doi, "10.1145/2858036.2858252");
  });

  it("strips trailing punctuation off a DOI", function () {
    const result = parseReferenceText(
      "[14] A. Bandura. 1991. Social cognitive theory of self-regulation. Organ. Behav. Hum. Decis. Process. 50, 2 (1991), 248–287. DOI:10.1016/0749-5978(91)90022-L.",
    );

    assert.equal(result.doi, "10.1016/0749-5978(91)90022-L");
  });

  it("returns only raw and doi when the text has no recognizable year", function () {
    const result = parseReferenceText(
      "[47] Lisa Yan, Annie Hu, and Chris Piech. Pensieve: Feedback on Coding",
    );

    assert.isUndefined(result.year);
    assert.isUndefined(result.authors);
    assert.isUndefined(result.title);
    assert.isUndefined(result.doi);
    assert.include(result.raw, "Pensieve");
  });

  it("strips the leading [N] marker from the raw text before parsing authors", function () {
    const result = parseReferenceText(
      "[9] Someone Author. 2020. A title here. Some Venue.",
    );

    assert.equal(result.authors, "Someone Author");
  });

  it("trims surrounding whitespace but preserves it in raw", function () {
    const result = parseReferenceText(
      "  [1] Jane Doe. 2019. A Paper Title. A Venue.  ",
    );

    assert.equal(result.raw, "[1] Jane Doe. 2019. A Paper Title. A Venue.");
    assert.equal(result.authors, "Jane Doe");
  });
});
