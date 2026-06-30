const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("quiz flow integrates browser history for mobile back navigation", () => {
  assert.match(html, /const QUIZ_HISTORY_STATE_KEY = "maogaiQuizStatus";/);
  assert.match(html, /const pushQuizHistory = \(nextStatus\) => \{/);
  assert.match(html, /window\.history\.pushState\(\{/);
  assert.match(html, /const handleQuizHistoryPop = \(event\) => \{/);
  assert.match(html, /window\.addEventListener\("popstate", handleQuizHistoryPop\)/);
  assert.match(html, /window\.removeEventListener\("popstate", handleQuizHistoryPop\)/);
  assert.match(html, /pushQuizHistory\("quiz"\)/);
  assert.match(html, /pushQuizHistory\("result"\)/);
  assert.match(html, /@click="goToSetup"/);
});

test("quiz status transitions reset the page scroll position", () => {
  assert.match(html, /const scrollQuizPageToTop = \(\) => \{/);
  assert.match(html, /nextTick\(\(\) => window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)\)/);
  assert.match(html, /status\.value = "quiz";\s*scrollQuizPageToTop\(\);\s*pushQuizHistory\("quiz"\)/);
  assert.match(html, /status\.value = "result";\s*scrollQuizPageToTop\(\);\s*pushQuizHistory\("result"\)/);
});
