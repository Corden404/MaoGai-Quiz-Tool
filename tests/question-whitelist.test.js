const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  buildQuestionRanges,
  escapeSqlLiteral,
  generateWhitelistSql,
  injectWhitelistSql,
  loadQuestionIds,
  replaceWhitelistSql,
} = require("../scripts/generate-valid-question-sql.js");

test("loads every unique question ID from both question banks", () => {
  const root = path.resolve(__dirname, "..");
  const ids = loadQuestionIds(root);

  assert.equal(ids.length, 914);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b, "zh-CN")));
});

test("compresses every question ID into deterministic continuous ranges", () => {
  const root = path.resolve(__dirname, "..");
  const ids = loadQuestionIds(root);
  const ranges = buildQuestionRanges(ids);
  const first = generateWhitelistSql(ids);
  const second = generateWhitelistSql([...ids].reverse());
  const expanded = ranges.flatMap(({ prefix, width, start, end }) =>
    Array.from(
      { length: end - start + 1 },
      (_, index) => `${prefix}${String(start + index).padStart(width, "0")}`,
    ),
  );

  assert.equal(ranges.length, 119);
  assert.deepEqual(
    [...expanded].sort((a, b) => a.localeCompare(b, "zh-CN")),
    ids,
  );
  assert.equal(first, second);
  assert.match(first, /^insert into private_security\.valid_questions/m);
  assert.match(first, /generate_series/);
  assert.match(first, /on conflict \(question_id\) do nothing;$/);
  assert.ok(first.length < 10000, "range SQL should stay compact");
});

test("escapes SQL string literals", () => {
  assert.equal(escapeSqlLiteral("author's-id"), "author''s-id");
  assert.match(generateWhitelistSql(["author's-id01"]), /\('author''s-id', 2, 1, 1\)/);
});

test("injects generated SQL at one explicit migration marker", () => {
  const template = "before\n-- {{VALID_QUESTION_SQL}}\nafter\n";
  const result = injectWhitelistSql(template, "insert statement;");

  assert.equal(result, "before\ninsert statement;\nafter\n");
  assert.throws(
    () => injectWhitelistSql("missing marker", "insert statement;"),
    /exactly one whitelist marker/,
  );
  assert.throws(
    () =>
      injectWhitelistSql(
        "-- {{VALID_QUESTION_SQL}}\n-- {{VALID_QUESTION_SQL}}",
        "insert statement;",
      ),
    /exactly one whitelist marker/,
  );
});

test("replaces one existing generated whitelist statement", () => {
  const existing = [
    "before",
    "insert into private_security.valid_questions (question_id)",
    "values",
    "  ('old-id')",
    "on conflict (question_id) do nothing;",
    "after",
  ].join("\n");

  assert.equal(
    replaceWhitelistSql(existing, "insert into replacement;"),
    "before\ninsert into replacement;\nafter",
  );
  assert.throws(
    () => replaceWhitelistSql("missing generated statement", "replacement"),
    /exactly one generated whitelist statement/,
  );
});
