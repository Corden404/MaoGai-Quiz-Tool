const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const QUESTION_FILES = [
  { filename: "questions.js", globalName: "QUESTIONS_DATA" },
  { filename: "mayuan_questions.js", globalName: "MAYUAN_QUESTIONS_DATA" },
];

const escapeSqlLiteral = (value) => String(value).replace(/'/g, "''");

const loadQuestionFile = (root, { filename, globalName }) => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, filename), "utf8"), context, {
    filename,
  });
  const questions = context.window[globalName];
  if (!Array.isArray(questions)) {
    throw new Error(`${filename} did not define window.${globalName}`);
  }
  return questions;
};

const loadQuestionIds = (root) => {
  const ids = QUESTION_FILES.flatMap((file) =>
    loadQuestionFile(root, file).map((question) => String(question.id || "").trim()),
  );
  if (ids.some((id) => id.length === 0)) {
    throw new Error("Every question must have a non-empty ID");
  }
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b, "zh-CN"));
};

const buildQuestionRanges = (questionIds) => {
  const grouped = new Map();
  for (const id of new Set(questionIds.map((value) => String(value)))) {
    const match = id.match(/^(.*?)(\d+)$/u);
    if (!match) {
      throw new Error(`Question ID does not end with a number: ${id}`);
    }
    const [, prefix, numberText] = match;
    const key = `${prefix}\u0000${numberText.length}`;
    if (!grouped.has(key)) {
      grouped.set(key, { prefix, width: numberText.length, numbers: [] });
    }
    grouped.get(key).numbers.push(Number(numberText));
  }

  const ranges = [];
  for (const group of grouped.values()) {
    const numbers = [...new Set(group.numbers)].sort((a, b) => a - b);
    let start = numbers[0];
    let end = numbers[0];
    for (let index = 1; index <= numbers.length; index += 1) {
      const next = numbers[index];
      if (next !== end + 1) {
        ranges.push({
          prefix: group.prefix,
          width: group.width,
          start,
          end,
        });
        start = next;
      }
      end = next;
    }
  }
  return ranges.sort((a, b) => {
    const prefixOrder = a.prefix.localeCompare(b.prefix, "zh-CN");
    return prefixOrder || a.width - b.width || a.start - b.start;
  });
};

const generateWhitelistSql = (questionIds) => {
  const ranges = buildQuestionRanges(questionIds);
  const values = ranges
    .map(
      ({ prefix, width, start, end }) =>
        `  ('${escapeSqlLiteral(prefix)}', ${width}, ${start}, ${end})`,
    )
    .join(",\n");
  return [
    "insert into private_security.valid_questions (question_id)",
    "select",
    "  question_range.prefix",
    "  || pg_catalog.lpad(question_number::text, question_range.width, '0')",
    "from (values",
    values,
    ") as question_range(prefix, width, start_number, end_number)",
    "cross join lateral pg_catalog.generate_series(",
    "  question_range.start_number,",
    "  question_range.end_number",
    ") as question_number",
    "on conflict (question_id) do nothing;",
  ].join("\n");
};

const WHITELIST_MARKER = "-- {{VALID_QUESTION_SQL}}";

const injectWhitelistSql = (template, whitelistSql) => {
  const matches = template.split(WHITELIST_MARKER);
  if (matches.length !== 2) {
    throw new Error("Migration template must contain exactly one whitelist marker");
  }
  return `${matches[0]}${whitelistSql}${matches[1]}`;
};

const GENERATED_WHITELIST_PATTERN =
  /insert into private_security\.valid_questions \(question_id\)[\s\S]*?on conflict \(question_id\) do nothing;/g;

const replaceWhitelistSql = (migration, whitelistSql) => {
  const matches = migration.match(GENERATED_WHITELIST_PATTERN) || [];
  if (matches.length !== 1) {
    throw new Error("Migration must contain exactly one generated whitelist statement");
  }
  return migration.replace(GENERATED_WHITELIST_PATTERN, whitelistSql);
};

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const sql = generateWhitelistSql(loadQuestionIds(root));
  if (process.argv[2] === "--inject" && process.argv[3]) {
    const target = path.resolve(process.cwd(), process.argv[3]);
    const template = fs.readFileSync(target, "utf8");
    fs.writeFileSync(target, injectWhitelistSql(template, sql), "utf8");
  } else if (process.argv[2] === "--replace" && process.argv[3]) {
    const target = path.resolve(process.cwd(), process.argv[3]);
    const migration = fs.readFileSync(target, "utf8");
    fs.writeFileSync(target, replaceWhitelistSql(migration, sql), "utf8");
  } else {
    process.stdout.write(`${sql}\n`);
  }
}

module.exports = {
  buildQuestionRanges,
  escapeSqlLiteral,
  generateWhitelistSql,
  injectWhitelistSql,
  loadQuestionIds,
  replaceWhitelistSql,
};
