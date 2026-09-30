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

  it("parses an IEEE-style reference with a curly-quoted title", function () {
    const result = parseReferenceText(
      "[23] L. H. Hsia, Y. N. Lin, and G. J. Hwang, \u201CA creative problem solvingbased flipped learning strategy for promoting students\u2019 performing creativity,\u201D British Journal of Educational Technology, vol. 52, no. 4, pp. 1771-1787, 2021.",
    );
    assert.equal(result.authors, "L. H. Hsia, Y. N. Lin, and G. J. Hwang");
    assert.equal(
      result.title,
      "A creative problem solvingbased flipped learning strategy for promoting students\u2019 performing creativity",
    );
    assert.equal(result.year, "2021");
  });

  it("parses an IEEE-style reference with a straight-quoted title", function () {
    const result = parseReferenceText(
      '[24] V. S. Vaghela and D. F. Parsana, "Teaching and Learning: Fostering Student Engagement, Critical Thinking, and Lifelong Learning Skills," 2024.',
    );
    assert.equal(result.authors, "V. S. Vaghela and D. F. Parsana");
    assert.equal(
      result.title,
      "Teaching and Learning: Fostering Student Engagement, Critical Thinking, and Lifelong Learning Skills",
    );
    assert.equal(result.year, "2024");
  });

  it("ends a title at its final question mark instead of running into the venue", function () {
    const result = parseReferenceText(
      "[47] Klaus R Scherer. 2005. What are emotions? And how can they be measured? Social science information 44, 4 (2005), 695–729.",
    );
    assert.equal(result.authors, "Klaus R Scherer");
    assert.equal(
      result.title,
      "What are emotions? And how can they be measured?",
    );
  });

  it("ends a title at an exclamation mark followed by the venue", function () {
    const result = parseReferenceText(
      "[3] Jane Doe. 2021. Stop the bleeding! In Proceedings of X 2021. ACM, 12–19.",
    );
    assert.equal(result.title, "Stop the bleeding!");
  });

  it("keeps a question mark inside a title that ends with a full stop", function () {
    const result = parseReferenceText(
      "[8] Jane Doe. 2020. Is programming hard? A study of novices. In Proc. X. ACM.",
    );
    assert.equal(result.title, "Is programming hard? A study of novices");
  });

  it("keeps a question mark when what follows isn't a venue", function () {
    const result = parseReferenceText(
      "[6] Jane Doe. 2019. Who wins? Two players and a board",
    );
    assert.equal(result.title, "Who wins? Two players and a board");
  });

  it("keeps parsing author-year style when the title itself contains quotes", function () {
    const result = parseReferenceText(
      '[5] Jane Doe. 2019. Why "vibe coding" fails. In Proc. X. ACM.',
    );
    assert.equal(result.authors, "Jane Doe");
    assert.equal(result.title, 'Why "vibe coding" fails');
  });
});
