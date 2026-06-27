const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("quiz page loads and binds swipe navigation to the question card", () => {
  assert.match(html, /<script src="\.\/src\/swipe-navigation\.js" defer><\/script>/);
  assert.match(html, /@touchstart\.passive="handleQuestionTouchStart"/);
  assert.match(html, /@touchend\.passive="handleQuestionTouchEnd"/);
  assert.match(html, /SwipeNavigation\.resolveSwipeAction/);
  assert.match(html, /if \(action === "previous"\) prevQuestion\(\);/);
  assert.match(html, /if \(action === "next"\) nextQuestion\(\);/);
});

test("swipe navigation ignores text and note editing areas", () => {
  assert.match(html, /SwipeNavigation\.isSwipeIgnoredTarget\(event\.target\)/);
  assert.match(html, /data-swipe-ignore/);
  assert.match(html, /<textarea ref="textarea"[\s\S]*data-swipe-ignore/);
  assert.match(html, /<div v-if="showNote"[\s\S]*data-swipe-ignore/);
});

test("bottom navigation is persistent on mobile and lightweight on desktop", () => {
  const quizContent = html.match(/<!-- 题目卡片 -->[\s\S]*?<!-- 🚀 固定底部操作栏/);
  const bottomBar = html.match(/<!-- 🚀 固定底部操作栏[\s\S]*?<!-- 3\. 结算页面/);
  const desktopNavStyle = html.match(/\.desktop-quiz-nav\s*\{([\s\S]*?)\n    \}/);

  assert.ok(quizContent, "quiz content before bottom action bar should exist");
  assert.ok(bottomBar, "bottom action bar should exist");
  assert.ok(desktopNavStyle, "desktop nav style should exist");
  assert.match(bottomBar[0], /class="quiz-bottom-actions /);
  assert.match(bottomBar[0], /class="mobile-quiz-nav quiz-nav-actions flex flex-row gap-3"/);
  assert.doesNotMatch(bottomBar[0], /desktop-quiz-nav/);
  assert.match(quizContent[0], /笔记与解题广场/);
  assert.match(quizContent[0], /不会，直接看解析/);
  assert.match(quizContent[0], /class="quiz-card-action-row desktop-quiz-nav quiz-nav-actions[^"]*"/);
  assert.match(quizContent[0], /class="desktop-quiz-nav-button"/);
  assert.doesNotMatch(bottomBar[0], /v-if="shouldShowDesktopNavigation"/);
  assert.match(html, /\.mobile-quiz-nav\s*\{[\s\S]*display: flex;/);
  assert.match(desktopNavStyle[1], /display: none;/);
  assert.match(desktopNavStyle[1], /width: 100%;/);
  assert.match(desktopNavStyle[1], /justify-content: space-between;/);
  assert.doesNotMatch(desktopNavStyle[1], /background:/);
  assert.doesNotMatch(desktopNavStyle[1], /border:/);
  assert.doesNotMatch(desktopNavStyle[1], /box-shadow:/);
  assert.match(html, /\.desktop-quiz-nav-button\s*\{[\s\S]*min-width: 7\.25rem;/);
  assert.match(html, /\.desktop-quiz-nav-button\s*\{[\s\S]*min-height: 2\.5rem;/);
  assert.match(html, /@media \(min-width: 640px\) \{[\s\S]*\.mobile-quiz-nav\s*\{[\s\S]*display: none;/);
  assert.match(html, /@media \(min-width: 640px\) \{[\s\S]*\.desktop-quiz-nav\s*\{[\s\S]*display: flex;/);
  assert.match(html, /@media \(min-width: 640px\) \{[\s\S]*\.quiz-bottom-actions\s*\{[\s\S]*background: transparent !important;[\s\S]*box-shadow: none !important;/);
  assert.doesNotMatch(html, /const shouldShowDesktopNavigation = computed\(\(\) =>/);
  assert.match(quizContent[0], /@click="prevQuestion"/);
  assert.match(quizContent[0], /@click="nextQuestion"/);
});
