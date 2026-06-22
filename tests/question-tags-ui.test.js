const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

test("loads the shared question tag module", () => {
  assert.match(html, /<script src="src\/question-tags\.js"><\/script>/);
});

test("cache-busts the generated stylesheet after layout changes", () => {
  assert.match(
    html,
    /<link rel="stylesheet" href="style\.css\?v=question-tags-four-column">/,
  );
});

test("quiz order contains only sequence and random", () => {
  const modeSection = html.match(/<!-- ③ 刷题模式 -->([\s\S]*?)<!-- ④ 题目标签 -->/);
  assert.ok(modeSection, "mode and question-tag section boundary should exist");
  assert.match(modeSection[1], /val:'sequence'/);
  assert.match(modeSection[1], /val:'random'/);
  assert.doesNotMatch(modeSection[1], /val:'global_mistake'/);
  assert.doesNotMatch(modeSection[1], /val:'mistake'/);
  assert.doesNotMatch(modeSection[1], /val:'star'/);
  assert.doesNotMatch(modeSection[1], /val:'key'/);
  assert.doesNotMatch(modeSection[1], /val:'hard'/);
});

test("shows four vertical setup cards side by side on desktop", () => {
  assert.match(html, /<div id="app" class="max-w-7xl mx-auto p-4">/);
  assert.match(html, /<!-- 四栏并列布局 -->\s*<div class="grid grid-cols-1 md:grid-cols-4/);
  assert.match(html, /<span class="text-brand-500 font-extrabold">3\.<\/span> 刷题顺序/);
});

test("renders a fourth mandatory multi-select question tag section", () => {
  assert.match(
    html,
    /<div id="guide-question-tags"\s+class="section-card bg-white/,
  );
  assert.match(html, /<span class="text-brand-500 font-extrabold">4\.<\/span> 题目标签/);
  assert.match(html, /\{ value: "global_mistake", label: "全网易错", icon: "🔥" \}/);
  assert.match(html, /v-for="tag in questionTagOptions"/);
  assert.match(html, /@click="toggleQuestionFilterTag\(tag\.value\)"/);
  assert.match(html, /selectedQuestionTags\.includes\(tag\.value\)/);
  assert.match(html, /const selectedQuestionTags = ref\(\["all"\]\)/);
  assert.match(html, /QuestionTags\.toggleQuestionTag/);
});

test("shows the mistake threshold only when mistake is selected", () => {
  assert.match(html, /v-if="selectedQuestionTags\.includes\('mistake'\)"/);
  assert.match(html, /v-model\.number="mistakeMinCount"/);
});

test("shows the global mistake threshold only when its tag is selected", () => {
  assert.match(html, /v-if="selectedQuestionTags\.includes\('global_mistake'\)"/);
  assert.match(html, /v-model\.number="globalMistakeMinRate"/);
});

test("setup summary includes both mode and question tags", () => {
  assert.match(
    html,
    /\{\{ modeLabels\[mode\] \|\| mode \}\} · \{\{ selectedQuestionTagSummary \}\}/,
  );
  assert.match(html, /QuestionTags\.getQuestionTagSummary/);
});

test("fetches global IDs before shared tag filtering and randomization", () => {
  const startQuizStart = html.indexOf("const startQuiz = async");
  const startQuizEnd = html.indexOf("const loadQuestionState", startQuizStart);
  const startQuiz = html.slice(startQuizStart, startQuizEnd);
  const globalFilter = startQuiz.indexOf("selectedQuestionTags.value.includes");
  const tagFilter = startQuiz.indexOf("QuestionTags.filterQuestionsByTags");
  const randomFilter = startQuiz.indexOf('if (mode.value === "random")');

  assert.ok(globalFilter >= 0, "global mistake tag fetch should exist");
  assert.ok(tagFilter > globalFilter, "question tags should run after global filtering");
  assert.ok(randomFilter > tagFilter, "randomization should run after question tags");
  assert.match(startQuiz, /selectedQuestionTags\.value/);
  assert.match(startQuiz, /safeMistakeMinCount/);
  assert.match(startQuiz, /globalMistakeIds/);
});

test("removes legacy mutually exclusive mode branches", () => {
  assert.doesNotMatch(html, /mode\.value === "mistake"/);
  assert.doesNotMatch(html, /mode\.value === "global_mistake"/);
  assert.doesNotMatch(html, /\["star", "key", "hard"\]\.includes\(mode\.value\)/);
});

test("an empty combined result clears the starting state", () => {
  assert.match(
    html,
    /if \(filtered\.length === 0\) \{\s*isStartingQuiz\.value = false;\s*showToast\("没有找到符合条件的题目", "info"\);/,
  );
});

test("onboarding teaches modes and combinable question tags separately", () => {
  assert.match(html, /element: '#guide-mode'[\s\S]*title: '3\. 刷题顺序'/);
  assert.match(html, /element: '#guide-mode'[\s\S]*顺序和随机/);
  assert.match(html, /element: '#guide-question-tags'[\s\S]*全网易错/);
  assert.match(html, /element: '#guide-question-tags'[\s\S]*可同时选择多个/);
});

test("README describes combinable OR-style question tags", () => {
  assert.match(readme, /顺序练习和随机抽题/);
  assert.match(readme, /错题、全网易错、星标、重点和难记标签可同时选择/);
  assert.match(readme, /命中任一所选标签/);
});
