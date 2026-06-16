const assert = require("node:assert/strict");
const test = require("node:test");

const exporter = require("../src/export-mistakes.js");

const sampleQuestions = [
  {
    id: "q-1",
    chapter: "第一章",
    type: "单项选择题",
    question_content: "中国革命的首要对象是？",
    options: {
      A: "封建主义",
      B: "帝国主义",
      C: "官僚资本主义",
      D: "民族资本主义",
    },
    answer: "B",
    note: "先看主要矛盾。",
    error_count: 3,
    tag_star: true,
  },
  {
    id: "q-2",
    chapter: "第二章",
    type: "辨析题",
    question_content: "新民主主义革命是社会主义革命。",
    answer: "错误。新民主主义革命属于资产阶级民主革命范畴。",
    error_count: 1,
    tag_key: true,
  },
  {
    id: "q-3",
    chapter: "第三章",
    type: "简答题",
    question_content: "这道题没有错过。",
    answer: "略",
    error_count: 0,
    tag_hard: true,
  },
];

test("selectMistakeQuestions filters by minimum mistake count and sorts by mistakes desc", () => {
  const result = exporter.selectMistakeQuestions(sampleQuestions, { minCount: 2 });

  assert.deepEqual(
    result.map((q) => q.id),
    ["q-1"],
  );
});

test("formatMistakesMarkdown renders reader friendly question details", () => {
  const mistakes = exporter.selectMistakeQuestions(sampleQuestions, { minCount: 1 });
  const markdown = exporter.formatMistakesMarkdown(mistakes, {
    subjectName: "毛概",
    minCount: 1,
    generatedAt: new Date("2026-06-16T01:30:00Z"),
  });

  assert.match(markdown, /^# 毛概错题本/);
  assert.match(markdown, /共 2 题/);
  assert.match(markdown, /## 第一章/);
  assert.match(markdown, /\*\*题型：\*\* 单项选择题/);
  assert.match(markdown, /\*\*错题次数：\*\* 3/);
  assert.match(markdown, /A\. 封建主义/);
  assert.match(markdown, /\*\*答案：\*\* B/);
  assert.match(markdown, /\*\*我的笔记：\*\* 先看主要矛盾。/);
});

test("selectExportQuestions supports mistake, star, key, and hard scopes", () => {
  assert.deepEqual(
    exporter.selectExportQuestions(sampleQuestions, { scope: "mistake", minCount: 2 }).map((q) => q.id),
    ["q-1"],
  );
  assert.deepEqual(
    exporter.selectExportQuestions(sampleQuestions, { scope: "star" }).map((q) => q.id),
    ["q-1"],
  );
  assert.deepEqual(
    exporter.selectExportQuestions(sampleQuestions, { scope: "key" }).map((q) => q.id),
    ["q-2"],
  );
  assert.deepEqual(
    exporter.selectExportQuestions(sampleQuestions, { scope: "hard" }).map((q) => q.id),
    ["q-3"],
  );
});

test("selectExportQuestions merges multiple scopes without duplicate questions", () => {
  const result = exporter.selectExportQuestions(sampleQuestions, {
    scopes: ["mistake", "star", "hard"],
    minCount: 2,
  });

  assert.deepEqual(
    result.map((q) => q.id),
    ["q-1", "q-3"],
  );
  assert.deepEqual(result[0].export_reasons, ["错题", "星标"]);
  assert.deepEqual(result[1].export_reasons, ["难记"]);
});

test("formatMistakesMarkdown uses scope title and condition text", () => {
  const markdown = exporter.formatMistakesMarkdown([sampleQuestions[0]], {
    subjectName: "毛概",
    scope: "star",
    generatedAt: new Date("2026-06-16T01:30:00Z"),
  });

  assert.match(markdown, /^# 毛概星标题本/);
  assert.match(markdown, /筛选条件：星标题目/);
});

test("formatMistakesMarkdown uses combined title and conditions for multiple scopes", () => {
  const markdown = exporter.formatMistakesMarkdown([sampleQuestions[0], sampleQuestions[2]], {
    subjectName: "毛概",
    scopes: ["mistake", "star", "hard"],
    minCount: 2,
    generatedAt: new Date("2026-06-16T01:30:00Z"),
  });

  assert.match(markdown, /^# 毛概综合题本/);
  assert.match(markdown, /筛选条件：错题次数 >= 2、星标题目、难记题目/);
  assert.match(markdown, /\*\*导出来源：\*\* 错题、星标/);
});

test("formatMistakesMarkdown can hide answers and notes", () => {
  const markdown = exporter.formatMistakesMarkdown([sampleQuestions[0]], {
    subjectName: "毛概",
    includeAnswer: false,
    includeNote: false,
    generatedAt: new Date("2026-06-16T01:30:00Z"),
  });

  assert.doesNotMatch(markdown, /\*\*答案：\*\*/);
  assert.doesNotMatch(markdown, /\*\*我的笔记：\*\*/);
});

test("formatMistakesText can sort by mistake count without chapter grouping", () => {
  const text = exporter.formatMistakesText([sampleQuestions[1], sampleQuestions[0]], {
    subjectName: "毛概",
    sortMode: "mistake",
    generatedAt: new Date("2026-06-16T01:30:00Z"),
  });

  assert.ok(text.indexOf("中国革命的首要对象") < text.indexOf("新民主主义革命"));
  assert.doesNotMatch(text, /第一章\n-+/);
});

test("formatMistakesText renders plain text without markdown markers", () => {
  const mistakes = exporter.selectMistakeQuestions(sampleQuestions, { minCount: 1 });
  const text = exporter.formatMistakesText(mistakes, {
    subjectName: "毛概",
    minCount: 1,
    generatedAt: new Date("2026-06-16T01:30:00Z"),
  });

  assert.match(text, /^毛概错题本/);
  assert.match(text, /第一章/);
  assert.match(text, /题型：单项选择题/);
  assert.match(text, /错题次数：3/);
  assert.match(text, /答案：B/);
  assert.doesNotMatch(text, /\*\*/);
});
