const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("loads the shared question tag module", () => {
  assert.match(html, /<script src="src\/question-tags\.js"><\/script>/);
});

test("quiz mode contains only sequence random and global mistake", () => {
  const modeSection = html.match(/<!-- ③ 刷题模式 -->([\s\S]*?)<!-- ④ 题目标签 -->/);
  assert.ok(modeSection, "mode and question-tag section boundary should exist");
  assert.match(modeSection[1], /val:'sequence'/);
  assert.match(modeSection[1], /val:'random'/);
  assert.match(modeSection[1], /val:'global_mistake'/);
  assert.doesNotMatch(modeSection[1], /val:'mistake'/);
  assert.doesNotMatch(modeSection[1], /val:'star'/);
  assert.doesNotMatch(modeSection[1], /val:'key'/);
  assert.doesNotMatch(modeSection[1], /val:'hard'/);
});

test("renders a fourth mandatory multi-select question tag section", () => {
  assert.match(html, /<span class="text-brand-500 font-extrabold">4\.<\/span> 题目标签/);
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

test("setup summary includes both mode and question tags", () => {
  assert.match(
    html,
    /\{\{ modeLabels\[mode\] \|\| mode \}\} · \{\{ selectedQuestionTagSummary \}\}/,
  );
  assert.match(html, /QuestionTags\.getQuestionTagSummary/);
});
