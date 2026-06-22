const assert = require("node:assert/strict");
const test = require("node:test");

const {
  filterQuestionsByTags,
  getQuestionTagSummary,
  matchesQuestionTags,
  normalizeQuestionTags,
  toggleQuestionTag,
} = require("../src/question-tags.js");

test("normalizes empty and all-inclusive selections to all only", () => {
  assert.deepEqual(normalizeQuestionTags([]), ["all"]);
  assert.deepEqual(normalizeQuestionTags(["all", "mistake", "star"]), ["all"]);
  assert.deepEqual(normalizeQuestionTags(["unknown"]), ["all"]);
});

test("keeps unique valid specific tags in display order", () => {
  assert.deepEqual(
    normalizeQuestionTags(["hard", "global_mistake", "star", "hard", "mistake"]),
    ["mistake", "global_mistake", "star", "hard"],
  );
});

test("selecting a specific tag removes all and selecting all clears specifics", () => {
  assert.deepEqual(toggleQuestionTag(["all"], "mistake"), ["mistake"]);
  assert.deepEqual(toggleQuestionTag(["mistake", "star"], "all"), ["all"]);
});

test("removing the last specific tag restores all", () => {
  assert.deepEqual(toggleQuestionTag(["mistake"], "mistake"), ["all"]);
  assert.deepEqual(toggleQuestionTag(["mistake", "star"], "mistake"), ["star"]);
});

const questions = [
  { id: "mistake", error_count: 2 },
  { id: "star", error_count: 0, tag_star: true },
  { id: "key-hard", error_count: 0, tag_key: true, tag_hard: true },
  { id: "plain", error_count: 0 },
];

test("all matches every question while specific tags use OR semantics", () => {
  assert.equal(matchesQuestionTags(questions[3], ["all"], 1), true);
  assert.deepEqual(
    filterQuestionsByTags(questions, ["mistake", "star"], 1).map((question) => question.id),
    ["mistake", "star"],
  );
  assert.deepEqual(
    filterQuestionsByTags(questions, ["star", "key", "hard"], 1).map((question) => question.id),
    ["star", "key-hard"],
  );
});

test("mistake matching clamps the threshold to at least one", () => {
  assert.equal(matchesQuestionTags({ error_count: 0 }, ["mistake"], 0), false);
  assert.equal(matchesQuestionTags({ error_count: 2 }, ["mistake"], 3), false);
  assert.equal(matchesQuestionTags({ error_count: 3 }, ["mistake"], 3), true);
});

test("a question matching multiple tags is returned only once", () => {
  const result = filterQuestionsByTags(
    [{ id: "combined", error_count: 4, tag_star: true, tag_key: true }],
    ["mistake", "star", "key"],
    1,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "combined");
});

test("builds a readable normalized selection summary", () => {
  assert.equal(getQuestionTagSummary(["all"]), "所有题目");
  assert.equal(
    getQuestionTagSummary(["hard", "global_mistake", "mistake", "star"]),
    "错题巩固、全网易错、星标练习、难记练习",
  );
});

test("global mistakes join local tags with OR semantics", () => {
  const result = filterQuestionsByTags(
    [
      { id: "global-only" },
      { id: "star-only", tag_star: true },
      { id: "both", tag_star: true },
      { id: "plain" },
    ],
    ["global_mistake", "star"],
    1,
    new Set(["global-only", "both"]),
  );

  assert.deepEqual(result.map((question) => question.id), [
    "global-only",
    "star-only",
    "both",
  ]);
});
