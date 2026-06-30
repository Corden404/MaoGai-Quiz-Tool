const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("quiz page loads and binds swipe navigation to the question card", () => {
  assert.match(html, /<script src="\.\/src\/swipe-navigation\.js" defer><\/script>/);
  assert.match(html, /@touchstart\.passive="handleQuestionTouchStart"/);
  assert.match(html, /@touchmove="handleQuestionTouchMove"/);
  assert.match(html, /@touchend\.passive="handleQuestionTouchEnd"/);
  assert.match(html, /SwipeNavigation\.resolveSwipeAction/);
  assert.match(html, /SwipeNavigation\.resolveSwipeDragOffset/);
  assert.match(html, /:style="questionCardStyle"/);
  assert.match(html, /animateQuestionCardTransition\(action\)/);
});

test("swipe card contains only the question body and answer controls", () => {
  const swipeCard = html.match(/<div[^>]*class="quiz-card-viewport"[\s\S]*?<\/div>\s*<\/div>\s*<!-- 提交后的结果反馈 -->/);

  assert.ok(swipeCard, "swipe card viewport should wrap the question body section");
  assert.match(swipeCard[0], /<!-- 题目内容 -->/);
  assert.match(swipeCard[0], /<!-- 交互区域 -->/);
  assert.match(swipeCard[0], /currentQuestion\.question_content/);
  assert.match(swipeCard[0], /@click="selectOption\(opt\)"/);
  assert.doesNotMatch(swipeCard[0], /题号与合并标签行/);
  assert.doesNotMatch(swipeCard[0], /toggleTag\('tag_star'\)/);
  assert.doesNotMatch(swipeCard[0], /笔记与解题广场/);
});

test("swipe card renders the adjacent question while dragging", () => {
  const swipeCard = html.match(/<div[^>]*class="quiz-card-viewport"[\s\S]*?<\/div>\s*<\/div>\s*<!-- 提交后的结果反馈 -->/);

  assert.ok(swipeCard, "swipe card viewport should exist");
  assert.match(swipeCard[0], /:style="questionCardViewportStyle"/);
  assert.match(swipeCard[0], /v-if="adjacentQuestionPreview"/);
  assert.match(swipeCard[0], /ref="adjacentQuestionCard"/);
  assert.match(swipeCard[0], /class="quiz-question-card quiz-question-card-preview/);
  assert.match(swipeCard[0], /:style="adjacentQuestionCardStyle"/);
  assert.match(swipeCard[0], /adjacentQuestionPreview\.question_content/);
  assert.match(html, /const questionCardViewportStyle = computed\(\(\) =>/);
  assert.match(html, /const adjacentQuestionPreview = computed\(\(\) =>/);
  assert.match(html, /const adjacentQuestionCardStyle = computed\(\(\) =>/);
});

test("swipe viewport expands to fit a taller adjacent preview", () => {
  assert.match(html, /const questionCardViewportMinHeight = ref\(""\);/);
  assert.match(html, /const updateQuestionCardViewportHeight = \(\) => \{/);
  assert.match(html, /adjacentQuestionCard\.value\?\.offsetHeight/);
  assert.match(html, /Math\.max\(currentHeight, adjacentHeight\)/);
  assert.match(html, /nextTick\(updateQuestionCardViewportHeight\);/);
  assert.match(html, /questionCardViewportMinHeight\.value = "";/);
});

test("completed swipe settles on the adjacent card without a second enter animation", () => {
  const transitionHandler = html.match(/const animateQuestionCardTransition = \(action\) => \{[\s\S]*?\n          \};/);

  assert.ok(transitionHandler, "swipe transition handler should exist");
  assert.doesNotMatch(transitionHandler[0], /enterOffset/);
  assert.match(transitionHandler[0], /if \(action === "previous"\) prevQuestion\(\);/);
  assert.match(transitionHandler[0], /if \(action === "next"\) nextQuestion\(\);/);
  assert.match(transitionHandler[0], /resetQuestionCardMotion\(\);/);
});

test("question card animation uses shared timing constants and drag progress styles", () => {
  assert.match(html, /const QUESTION_CARD_EXIT_MS = 220;/);
  assert.match(html, /const QUESTION_CARD_SNAP_MS = 200;/);
  assert.match(html, /const QUESTION_CARD_SETTLE_BUFFER_MS = 24;/);
  assert.match(html, /const QUESTION_CARD_TRANSITION_EASING = "cubic-bezier\(0\.22, 1, 0\.36, 1\)";/);
  assert.match(html, /const questionCardTransition = computed\(\(\) =>/);
  assert.match(html, /const questionCardDragProgress = computed\(\(\) =>/);
  assert.match(html, /const questionCardScale = computed\(\(\) =>/);
  assert.match(html, /const adjacentQuestionCardScale = computed\(\(\) =>/);
  assert.match(html, /opacity: questionCardOpacity\.value,/);
  assert.match(html, /opacity: adjacentQuestionCardOpacity\.value,/);
  assert.match(html, /questionCardTransitionMs\.value = QUESTION_CARD_EXIT_MS;/);
  assert.match(html, /questionCardTransitionMs\.value = QUESTION_CARD_SNAP_MS;/);
});

test("question card respects reduced motion preferences", () => {
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.quiz-question-card\s*\{[\s\S]*transition: none !important;/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.quiz-question-card\s+\*\s*\{[\s\S]*animation-duration: 0\.01ms !important;/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.quiz-question-card\s+\*\s*\{[\s\S]*transition-duration: 0\.01ms !important;/);
});

test("mobile previous and next buttons use the card transition animation", () => {
  const quizContent = html.match(/<!-- 题目卡片 -->[\s\S]*?<!-- 🚀 固定底部操作栏/);
  const bottomBar = html.match(/<!-- 🚀 固定底部操作栏[\s\S]*?<!-- 3\. 结算页面/);

  assert.ok(quizContent, "quiz content before bottom action bar should exist");
  assert.ok(bottomBar, "bottom action bar should exist");
  assert.match(bottomBar[0], /@click="prevQuestionWithAnimation"/);
  assert.match(bottomBar[0], /@click="nextQuestionWithAnimation"/);
  assert.match(quizContent[0], /@click="prevQuestion"/);
  assert.match(quizContent[0], /@click="nextQuestion"/);
  assert.match(html, /const prevQuestionWithAnimation = \(\) => animateQuestionCardTransition\("previous"\);/);
  assert.match(html, /const nextQuestionWithAnimation = \(\) => animateQuestionCardTransition\("next"\);/);
  assert.match(html, /prevQuestionWithAnimation,/);
  assert.match(html, /nextQuestionWithAnimation,/);
});

test("swipe dragging does not block native vertical page scrolling", () => {
  const touchMoveHandler = html.match(/const handleQuestionTouchMove = \(event\) => \{[\s\S]*?\n          \};/);

  assert.ok(touchMoveHandler, "touch move handler should exist");
  assert.doesNotMatch(touchMoveHandler[0], /preventDefault\(/);
  assert.match(html, /\.quiz-card-viewport\s*\{[\s\S]*touch-action: pan-y;/);
});

test("quiz content leaves enough mobile space above the fixed bottom actions", () => {
  assert.match(html, /v-if="status === 'quiz'" class="[^"]*\bquiz-page-shell\b/);
  assert.match(html, /\.quiz-page-shell\s*\{[\s\S]*padding-bottom: 13rem;/);
  assert.match(html, /@media \(min-width: 640px\) \{[\s\S]*\.quiz-page-shell\s*\{[\s\S]*padding-bottom: 7rem;/);
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
  const desktopMediaBottomActions = html.match(/@media \(min-width: 640px\) \{[\s\S]*?\.quiz-bottom-actions\s*\{([\s\S]*?)\n      \}/);

  assert.ok(quizContent, "quiz content before bottom action bar should exist");
  assert.ok(bottomBar, "bottom action bar should exist");
  assert.ok(desktopNavStyle, "desktop nav style should exist");
  assert.ok(desktopMediaBottomActions, "desktop bottom action style should exist");
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
  assert.match(desktopMediaBottomActions[1], /position: static !important;/);
  assert.match(desktopMediaBottomActions[1], /padding: 0 !important;/);
  assert.doesNotMatch(html, /const shouldShowDesktopNavigation = computed\(\(\) =>/);
  assert.match(quizContent[0], /@click="prevQuestion"/);
  assert.match(quizContent[0], /@click="nextQuestion"/);
});
