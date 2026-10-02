const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const security = require("../src/user-data-security.js");
const html = fs.readFileSync("index.html", "utf8");

function source(name) {
  const start = new RegExp(`^([ \\t]*)const ${name} =`, "m").exec(html);
  assert.ok(start, name);
  const end = html.indexOf(`\n${start[1]}};`, start.index);
  assert.ok(end > start.index, name);
  return html.slice(start.index, end + start[1].length + 4);
}

function app() {
  const ref = value => ({ value });
  const state = { ...security, authTransitionVersion: 0, quizHistoryEpoch: 0,
    quizHistoryDepth: 2, questionTouchStart: { x: 1 }, questionCardAnimationTimer: 123,
    localStorage: { getItem: () => null }, cancelPendingSync() {}, mergeProgressToQuestions() {},
    replaceQuizHistory: (status, depth) => { state.history = { status, depth }; },
    nextTick: fn => fn(), showToast() {}, console: { log() {}, error() {} },
    window: { clearTimeout: () => { state.timerCleared = true; } },
    supabaseClient: { auth: { signOut: async () => {} } },
    QuestionTags: require("../src/question-tags.js"),
    scrollQuizPageToTop() {}, pushQuizHistory() {},
  };
  const initial = {
    status: "quiz", queue: [{ id: "q1", chapter: "one", type: "choice" }], currentIndex: 0,
    currentUser: { id: "a" }, userProgress: security.createEmptyProgress(), isAuthTransitioning: false,
    attempts: { q1: { graded: true } }, stats: { correct: 7, wrong: 2 }, isMemorizeMode: true,
    isStartingQuiz: false, showAnswerSheet: true, showExportModal: true, isLoadingPublicNotes: true,
    userSelection: ["A"], userInputText: "private answer", hasSubmitted: true, isCorrect: true,
    subjectiveStatus: "correct", showErrorCount: true, showNote: true, noteTab: "public",
    noteContent: "private note", shareToPublic: true, publicNotes: [{ content: "old" }],
    showAllNotes: true, saveBtnText: "saved", textarea: null,
    questionCardOffsetX: 40, questionCardTransitionMs: 220, questionCardViewportMinHeight: "400px",
    isQuestionCardAnimating: true, allQuestions: [{ id: "q1", chapter: "one", type: "choice" }],
    selectedChapters: ["one"], selectedTypes: ["choice"], selectedQuestionTags: ["global_mistake"],
    mistakeMinCount: 1, globalMistakeMinRate: 0, mode: "sequence", randomCount: 20,
  };
  for (const [name, value] of Object.entries(initial)) state[name] = ref(value);
  state.currentQuestion = { get value() { return state.queue.value[state.currentIndex.value] || {}; } };
  const names = ["resetIdentityBoundView", "resetQuestionState", "resetQuestionCardMotion",
    "clearQuestionCardAnimationTimer", "applyAuthSession", "logout", "startQuiz",
    "fetchPublicNotes", "reportToGlobalStats", "selectOption", "nextQuestion", "handleQuizHistoryPop"];
  vm.createContext(state);
  vm.runInContext(names.map(source).join("\n") + `\nglobalThis.api = { ${names.join(",")} };`, state);
  return state;
}

test("logout clears the whole quiz session before another identity can use it", async () => {
  const s = app();
  await s.api.logout();
  assert.equal(s.currentUser.value, null);
  assert.equal(s.status.value, "setup");
  for (const name of ["queue", "userSelection", "publicNotes"]) assert.equal(s[name].value.length, 0, name);
  for (const name of ["userInputText", "noteContent", "questionCardViewportMinHeight"]) assert.equal(s[name].value, "", name);
  for (const name of ["showAnswerSheet", "showExportModal", "hasSubmitted", "isCorrect", "isMemorizeMode", "showNote", "shareToPublic", "isQuestionCardAnimating"]) assert.equal(s[name].value, false, name);
  assert.equal(s.subjectiveStatus.value, "pending");
  assert.equal(s.stats.value.correct + s.stats.value.wrong, 0);
  assert.equal(Object.keys(s.attempts.value).length, 0);
  assert.equal(s.quizHistoryDepth, 0);
  assert.equal(s.questionTouchStart, null);
  assert.equal(s.timerCleared, true);
  s.currentUser.value = { id: "b" };
  s.queue.value = [{ id: "q2" }];
  s.api.handleQuizHistoryPop({ state: { identityEpoch: 0, depth: 2, maogaiQuizStatus: "result" } });
  assert.equal(s.status.value, "setup");
});

test("a pending global-mistake lookup cannot restart the previous user's quiz", async () => {
  const s = app();
  let resolve;
  s.supabaseClient.rpc = () => new Promise(done => { resolve = done; });
  const start = s.api.startQuiz();
  await s.api.logout();
  resolve({ data: [{ question_id: "q1", error_rate: 1 }], error: null });
  await start;
  assert.equal(s.status.value, "setup");
  assert.equal(s.queue.value.length, 0);
});

test("late public-note results cannot restore the previous identity's view", async () => {
  const s = app();
  let resolve;
  s.supabaseClient.rpc = () => new Promise(done => { resolve = done; });
  const fetch = s.api.fetchPublicNotes();
  await s.api.logout();
  resolve({ data: [{ id: "note", content: "old", is_mine: true }], error: null });
  await fetch;
  assert.equal(s.publicNotes.value.length, 0);
  assert.equal(s.shareToPublic.value, false);
});

test("late statistics results cannot mark progress under the next identity", async () => {
  const s = app();
  let resolve;
  s.supabaseClient.rpc = () => new Promise(done => { resolve = done; });
  const report = s.api.reportToGlobalStats("q1", true);
  await s.api.logout();
  resolve({ error: null });
  await report;
  assert.equal(Object.keys(s.userProgress.value.reported_questions).length, 0);
});

test("quiz interactions are blocked while authentication changes", () => {
  const s = app();
  s.isAuthTransitioning.value = true;
  s.api.selectOption("C");
  s.api.nextQuestion();
  assert.deepEqual(s.userSelection.value, ["A"]);
  assert.equal(s.currentIndex.value, 0);
  assert.match(html, /:inert="isAuthTransitioning"/);
});
