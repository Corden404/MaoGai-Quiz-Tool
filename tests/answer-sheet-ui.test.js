const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("quiz page loads and exposes the answer sheet", () => {
  assert.match(html, /<script src="\.\/src\/answer-sheet\.js" defer><\/script>/);
  assert.match(html, /@click="showAnswerSheet = true"/);
  assert.match(html, /答题卡/);
  assert.match(html, /v-if="showAnswerSheet"/);
  assert.match(html, /answerSheetSummary\.unanswered/);
});

test("answer sheet renders question numbers and jumps to the selected question", () => {
  assert.match(html, /v-for="\(question, index\) in queue"/);
  assert.match(html, /@click="goToQuestion\(index\)"/);
  assert.match(html, /answerSheetButtonClass\(question, index\)/);
  assert.match(html, /\{\{ index \+ 1 \}\}/);
  assert.match(html, /const goToQuestion = \(index\) => \{/);
  assert.match(html, /storeCurrentAttempt\(\);[\s\S]*currentIndex\.value = index;[\s\S]*loadQuestionState\(\);[\s\S]*showAnswerSheet\.value = false;/);
});

test("answer sheet state uses the shared AnswerSheet helper", () => {
  assert.match(html, /const showAnswerSheet = ref\(false\)/);
  assert.match(html, /const answerSheetSummary = computed\(\(\) =>/);
  assert.match(html, /AnswerSheet\.getAnswerSheetSummary\(queue\.value, attempts\.value\)/);
  assert.match(html, /AnswerSheet\.isQuestionAnswered\(question, attempts\.value\[question\.id\]\)/);
});

test("result page shows unanswered question count next to correct and wrong counts", () => {
  const resultSection = html.match(/<!-- 统计卡片 -->([\s\S]*?)<!-- 正确率条 -->/);

  assert.ok(resultSection, "result statistics section should exist");
  assert.match(resultSection[1], /总题数/);
  assert.match(resultSection[1], /正确/);
  assert.match(resultSection[1], /错误/);
  assert.match(resultSection[1], /未作答/);
  assert.match(resultSection[1], /\{\{ answerSheetSummary\.unanswered \}\}/);
});
