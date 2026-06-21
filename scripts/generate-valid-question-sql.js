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

const generateWhitelistSql = (questionIds) => {
  const ids = [...new Set(questionIds.map((id) => String(id)))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
  const values = ids.map((id) => `  ('${escapeSqlLiteral(id)}')`).join(",\n");
  return [
    "insert into private_security.valid_questions (question_id)",
    "values",
    values,
    "on conflict (question_id) do nothing;",
  ].join("\n");
};

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  process.stdout.write(`${generateWhitelistSql(loadQuestionIds(root))}\n`);
}

module.exports = {
  escapeSqlLiteral,
  generateWhitelistSql,
  loadQuestionIds,
};
