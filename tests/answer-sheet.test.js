const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getAnswerSheetSummary,
  isQuestionAnswered,
} = require("../src/answer-sheet.js");

test("treats only graded attempts as answered", () => {
  assert.equal(isQuestionAnswered({ id: "q1" }, undefined), false);
  assert.equal(isQuestionAnswered({ id: "q1" }, { hasSubmitted: true, graded: false }), false);
  assert.equal(isQuestionAnswered({ id: "q1" }, { graded: true }), true);
});

test("summarizes answered and unanswered questions", () => {
  const queue = [{ id: "q1" }, { id: "q2" }, { id: "q3" }];
  const attempts = {
    q1: { graded: true },
    q2: { hasSubmitted: true, graded: false },
  };

  assert.deepEqual(getAnswerSheetSummary(queue, attempts), {
    total: 3,
    answered: 1,
    unanswered: 2,
  });
});
