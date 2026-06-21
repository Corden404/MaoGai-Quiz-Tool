const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  getAvailableShortcutOptions,
  isEditableTarget,
  resolveQuizKeyboardAction,
} = require("../src/keyboard-shortcuts.js");

test("returns only displayed A-D options", () => {
  assert.deepEqual(
    getAvailableShortcutOptions({ options: { A: "甲", C: "丙", E: "戊" } }),
    ["A", "C"],
  );
  assert.deepEqual(getAvailableShortcutOptions({}), ["A", "B", "C", "D"]);
});

test("recognizes form fields and editable content", () => {
  assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableTarget({ tagName: "textarea" }), true);
  assert.equal(isEditableTarget({ tagName: "SELECT" }), true);
  assert.equal(isEditableTarget({ isContentEditable: true, tagName: "DIV" }), true);
  assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
});

const baseContext = {
  target: { tagName: "BODY" },
  isQuizActive: true,
  isMemorizeMode: false,
  hasSubmitted: false,
  isModalOpen: false,
  isChoice: true,
  isObjective: true,
  availableOptions: ["A", "B", "C", "D"],
  selectionCount: 1,
};

test("maps upper and lower case A-D to displayed options", () => {
  assert.deepEqual(resolveQuizKeyboardAction({ ...baseContext, key: "a" }), {
    type: "select",
    option: "A",
  });
  assert.deepEqual(resolveQuizKeyboardAction({ ...baseContext, key: "D" }), {
    type: "select",
    option: "D",
  });
});

test("ignores unavailable and unrelated letter keys", () => {
  assert.equal(
    resolveQuizKeyboardAction({ ...baseContext, key: "B", availableOptions: ["A"] }),
    null,
  );
  assert.equal(resolveQuizKeyboardAction({ ...baseContext, key: "E" }), null);
});

test("submits with Enter only when an objective answer exists", () => {
  assert.deepEqual(resolveQuizKeyboardAction({ ...baseContext, key: "Enter" }), {
    type: "submit",
  });
  assert.equal(
    resolveQuizKeyboardAction({ ...baseContext, key: "Enter", selectionCount: 0 }),
    null,
  );
  assert.equal(
    resolveQuizKeyboardAction({ ...baseContext, key: "Enter", isObjective: false }),
    null,
  );
});

test("does not handle shortcuts in blocked interface states", () => {
  for (const overrides of [
    { isQuizActive: false },
    { isMemorizeMode: true },
    { hasSubmitted: true },
    { isModalOpen: true },
    { target: { tagName: "INPUT" } },
  ]) {
    assert.equal(resolveQuizKeyboardAction({ ...baseContext, key: "A", ...overrides }), null);
    assert.equal(resolveQuizKeyboardAction({ ...baseContext, key: "Enter", ...overrides }), null);
  }
});

test("does not map A-D for non-choice questions", () => {
  assert.equal(
    resolveQuizKeyboardAction({ ...baseContext, key: "A", isChoice: false }),
    null,
  );
});

const html = fs.readFileSync("index.html", "utf8");

test("loads and lifecycle-manages the quiz keyboard listener", () => {
  assert.match(html, /<script src="src\/keyboard-shortcuts\.js"><\/script>/);
  assert.match(
    html,
    /const \{ createApp, ref, computed, onMounted, onUnmounted, nextTick, watch \} = Vue;/,
  );
  assert.match(html, /window\.addEventListener\("keydown", handleQuizKeydown\)/);
  assert.match(html, /window\.removeEventListener\("keydown", handleQuizKeydown\)/);
});

test("delegates resolved keyboard actions to existing answer functions", () => {
  assert.match(html, /KeyboardShortcuts\.resolveQuizKeyboardAction/);
  assert.match(
    html,
    /KeyboardShortcuts\.getAvailableShortcutOptions\(currentQuestion\.value\)/,
  );
  assert.match(html, /selectOption\(action\.option\)/);
  assert.match(html, /submitAnswer\(\)/);
  assert.match(html, /event\.preventDefault\(\)/);
});
