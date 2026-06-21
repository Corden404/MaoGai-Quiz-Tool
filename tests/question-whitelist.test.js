const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  escapeSqlLiteral,
  generateWhitelistSql,
  loadQuestionIds,
} = require("../scripts/generate-valid-question-sql.js");

test("loads every unique question ID from both question banks", () => {
  const root = path.resolve(__dirname, "..");
  const ids = loadQuestionIds(root);

  assert.equal(ids.length, 914);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b, "zh-CN")));
});

test("generates deterministic SQL containing each ID exactly once", () => {
  const root = path.resolve(__dirname, "..");
  const ids = loadQuestionIds(root);
  const first = generateWhitelistSql(ids);
  const second = generateWhitelistSql([...ids].reverse());

  assert.equal(first, second);
  assert.match(first, /^insert into private_security\.valid_questions/m);
  assert.match(first, /on conflict \(question_id\) do nothing;$/);

  for (const id of ids) {
    const literal = `('${escapeSqlLiteral(id)}')`;
    assert.equal(first.split(literal).length - 1, 1, `expected one SQL row for ${id}`);
  }
});

test("escapes SQL string literals", () => {
  assert.equal(escapeSqlLiteral("author's-id"), "author''s-id");
  assert.match(generateWhitelistSql(["author's-id"]), /\('author''s-id'\)/);
});
