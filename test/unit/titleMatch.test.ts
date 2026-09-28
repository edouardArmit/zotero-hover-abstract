import { assert } from "chai";
import {
  compactTitle,
  firstAuthorLastName,
  MIN_SIMILARITY,
  pickBestMatch,
  retrievalWords,
  titleSimilarity,
  type TitleCandidate,
} from "../../src/modules/titleMatch";

const candidate = (
  id: number,
  title: string,
  creatorLastNames: string[] = [],
): TitleCandidate => ({ id, title, creatorLastNames });

describe("titleMatch", function () {
  describe("compactTitle", function () {
    it("drops case, punctuation and spaces", function () {
      assert.equal(
        compactTitle("Problem-Solving Skills Among 21st-Century Learners"),
        compactTitle("Problem-solving skills among 21stcentury learners"),
      );
    });

    it("strips accents and expands ligatures", function () {
      assert.equal(compactTitle("Eteläpelto"), "etelapelto");
      assert.equal(compactTitle("ﬁnding"), "finding");
    });
  });

  describe("titleSimilarity", function () {
    it("is 1 for titles that differ only by extraction artefacts", function () {
      assert.equal(
        titleSimilarity(
          "A creative problem solvingbased flipped learning strategy",
          "A Creative Problem Solving-Based Flipped Learning Strategy",
        ),
        1,
      );
    });

    it("stays high for a small typo or a dropped character", function () {
      const score = titleSimilarity(
        "Thinking processes used by high-performing students in a computer programming task",
        "Thinking processes used by high-performing students in a computer programing task",
      );
      assert.isAtLeast(score, MIN_SIMILARITY);
    });

    it("is low for unrelated titles", function () {
      assert.isBelow(
        titleSimilarity(
          "Academic emotions and student engagement",
          "Web-CAT: automatically grading programming assignments",
        ),
        0.4,
      );
    });

    it("is 0 for empty input", function () {
      assert.equal(titleSimilarity("", ""), 0);
      assert.equal(titleSimilarity("a", "abc"), 0);
    });
  });

  describe("retrievalWords", function () {
    it("picks the longest alphabetic words, skipping mangled tokens", function () {
      assert.deepEqual(
        retrievalWords(
          "Problem-solving skills among 21stcentury learners toward creativity and innovation ideas",
        ),
        ["creativity", "innovation", "learners"],
      );
    });

    it("ignores short words and duplicates", function () {
      assert.deepEqual(retrievalWords("Study of the study: a note"), ["study"]);
    });
  });

  describe("firstAuthorLastName", function () {
    it("handles ACM-style full names", function () {
      assert.equal(
        firstAuthorLastName("Andrew Luxton-Reilly, Simon, Ibrahim Albluwi"),
        "Luxton-Reilly",
      );
    });

    it("handles IEEE-style initials and 'and'", function () {
      assert.equal(firstAuthorLastName("S. Weiss and O. Wilhelm"), "Weiss");
      assert.equal(firstAuthorLastName("L. H. Hsia, Y. N. Lin"), "Hsia");
    });

    it("handles APA-style 'Last, I.' with an ampersand", function () {
      assert.equal(firstAuthorLastName("Smith, J., & Doe, K."), "Smith");
    });

    it("ignores 'et al.'", function () {
      assert.equal(
        firstAuthorLastName("B. Thornhill-Miller et al."),
        "Thornhill-Miller",
      );
      assert.equal(firstAuthorLastName("Jane Doe et al"), "Doe");
    });

    it("returns undefined for an empty author string", function () {
      assert.isUndefined(firstAuthorLastName(""));
    });
  });

  describe("pickBestMatch", function () {
    const ref =
      "Problem-solving skills among 21stcentury learners toward creativity and innovation ideas";

    it("accepts an exact match after compacting, even with no author known", function () {
      const match = pickBestMatch(ref, undefined, [
        candidate(1, "Creativity in the classroom"),
        candidate(
          2,
          "Problem-Solving Skills Among 21st-Century Learners Toward Creativity and Innovation Ideas",
        ),
      ]);
      assert.deepEqual(match, { id: 2, similarity: 1 });
    });

    it("requires the first author for a near (non-exact) match", function () {
      const nearTitle =
        "Thinking processes used by high-performing students in a computer programing task";
      const refTitle =
        "Thinking processes used by high-performing students in a computer programming task";
      assert.isUndefined(
        pickBestMatch(refTitle, "Havenga", [
          candidate(3, nearTitle, ["Someone"]),
        ]),
      );
      assert.equal(
        pickBestMatch(refTitle, "Havenga", [
          candidate(3, nearTitle, ["Havenga", "Mentz"]),
        ])?.id,
        3,
      );
    });

    it("matches a surname with a particle either way round", function () {
      const refTitle = "A long enough title about programming education";
      const nearTitle = "A long enough title about programing education";
      assert.equal(
        pickBestMatch(refTitle, "Villiers", [
          candidate(4, nearTitle, ["De Villiers"]),
        ])?.id,
        4,
      );
    });

    it("rejects titles below the similarity threshold", function () {
      assert.isUndefined(
        pickBestMatch("Computational Thinking", "Wing", [
          candidate(5, "Computational Thinking in Primary Schools", ["Wing"]),
        ]),
      );
    });

    it("prefers the most similar candidate", function () {
      const match = pickBestMatch(ref, "Adeoye", [
        candidate(
          6,
          "Problem-solving skills among 21st century learners toward creativity and innovation idea",
          ["Adeoye"],
        ),
        candidate(
          7,
          "Problem-Solving Skills Among 21st-Century Learners Toward Creativity and Innovation Ideas",
          ["Adeoye"],
        ),
      ]);
      assert.equal(match?.id, 7);
    });
  });
});
