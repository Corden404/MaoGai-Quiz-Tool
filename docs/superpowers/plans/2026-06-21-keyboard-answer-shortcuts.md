# Keyboard Answer Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add A–D option toggling and Enter-to-submit keyboard controls to the quiz page without interfering with text entry, dialogs, memorize mode, or submitted questions.

**Architecture:** Put deterministic keyboard-routing rules in a small UMD module that works in both the browser and Node's test runner. The Vue component will install one lifecycle-managed `keydown` listener, build a context object from its existing reactive state, and delegate accepted actions to the existing `selectOption` and `submitAnswer` functions.

**Tech Stack:** Vanilla JavaScript, Vue 3 Composition API from CDN, Node.js built-in `node:test`.

## Global Constraints

- A–D are case-insensitive and only affect displayed choice options.
- Enter submits only an unanswered objective question with at least one selected answer.
- Submitted questions remain on the current question when Enter is pressed again.
- Shortcuts are disabled outside the quiz screen, in memorize mode, while a dialog/menu is open, and while focus is in `input`, `textarea`, `select`, or editable content.
- Judgment and subjective questions do not respond to A–D.
- Do not add E/F, navigation shortcuts, dependencies, or changes to mouse behavior.

---

## File Structure

- Create `src/keyboard-shortcuts.js`: pure keyboard target detection, available-option calculation, and action routing; exported through UMD as `KeyboardShortcuts`.
- Create `tests/keyboard-shortcuts.test.js`: behavior tests for the pure routing module.
- Modify `index.html`: load the module, import `onUnmounted`, and register/remove the single Vue keyboard listener.

### Task 1: Keyboard Routing Module

**Files:**
- Create: `tests/keyboard-shortcuts.test.js`
- Create: `src/keyboard-shortcuts.js`

**Interfaces:**
- Consumes: a question object and a plain context object supplied by the Vue layer.
- Produces:
  - `getAvailableShortcutOptions(question): string[]`
  - `isEditableTarget(target): boolean`
  - `resolveQuizKeyboardAction(context): null | { type: "select", option: string } | { type: "submit" }`

- [ ] **Step 1: Write failing tests for option availability and editable targets**

```js
const assert = require("node:assert/strict");
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
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `node --test tests/keyboard-shortcuts.test.js`

Expected: FAIL because `src/keyboard-shortcuts.js` does not exist.

- [ ] **Step 3: Add routing tests**

Append tests covering:

```js
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
```

- [ ] **Step 4: Implement the minimal UMD module**

Create `src/keyboard-shortcuts.js`:

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KeyboardShortcuts = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const SHORTCUT_OPTIONS = ["A", "B", "C", "D"];
  const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

  const getAvailableShortcutOptions = (question = {}) => {
    if (!question.options || typeof question.options !== "object") {
      return SHORTCUT_OPTIONS.slice();
    }
    return SHORTCUT_OPTIONS.filter((option) => Boolean(question.options[option]));
  };

  const isEditableTarget = (target) => {
    if (!target) return false;
    const tagName = String(target.tagName || "").toUpperCase();
    return EDITABLE_TAGS.has(tagName) || target.isContentEditable === true;
  };

  const resolveQuizKeyboardAction = (context = {}) => {
    if (
      !context.isQuizActive ||
      context.isMemorizeMode ||
      context.hasSubmitted ||
      context.isModalOpen ||
      isEditableTarget(context.target)
    ) {
      return null;
    }

    if (context.key === "Enter") {
      return context.isObjective && context.selectionCount > 0
        ? { type: "submit" }
        : null;
    }

    const option = String(context.key || "").toUpperCase();
    if (
      context.isChoice &&
      SHORTCUT_OPTIONS.includes(option) &&
      context.availableOptions.includes(option)
    ) {
      return { type: "select", option };
    }

    return null;
  };

  return {
    getAvailableShortcutOptions,
    isEditableTarget,
    resolveQuizKeyboardAction,
  };
});
```

- [ ] **Step 5: Run the routing tests and verify GREEN**

Run: `node --test tests/keyboard-shortcuts.test.js`

Expected: all keyboard shortcut tests pass with zero failures.

- [ ] **Step 6: Commit the tested routing module**

```powershell
git add -- src/keyboard-shortcuts.js tests/keyboard-shortcuts.test.js
git commit -m "feat: add keyboard shortcut routing"
```

### Task 2: Vue Keyboard Listener Integration

**Files:**
- Modify: `index.html`
- Test: `tests/keyboard-shortcuts.test.js`

**Interfaces:**
- Consumes: `window.KeyboardShortcuts.getAvailableShortcutOptions` and `window.KeyboardShortcuts.resolveQuizKeyboardAction` from Task 1.
- Produces: lifecycle-managed `handleQuizKeydown(event): void`, delegating to existing `selectOption(option)` and `submitAnswer()`.

- [ ] **Step 1: Write a failing HTML integration test**

Append:

```js
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");

test("loads and lifecycle-manages the quiz keyboard listener", () => {
  assert.match(html, /<script src="src\/keyboard-shortcuts\.js"><\/script>/);
  assert.match(html, /const \{ createApp, ref, computed, onMounted, onUnmounted, nextTick, watch \} = Vue;/);
  assert.match(html, /window\.addEventListener\("keydown", handleQuizKeydown\)/);
  assert.match(html, /window\.removeEventListener\("keydown", handleQuizKeydown\)/);
});

test("delegates resolved keyboard actions to existing answer functions", () => {
  assert.match(html, /KeyboardShortcuts\.resolveQuizKeyboardAction/);
  assert.match(html, /KeyboardShortcuts\.getAvailableShortcutOptions\(currentQuestion\.value\)/);
  assert.match(html, /selectOption\(action\.option\)/);
  assert.match(html, /submitAnswer\(\)/);
  assert.match(html, /event\.preventDefault\(\)/);
});
```

- [ ] **Step 2: Run the integration tests and verify RED**

Run: `node --test tests/keyboard-shortcuts.test.js`

Expected: FAIL because `index.html` does not yet load or register the keyboard shortcut module.

- [ ] **Step 3: Load the module and import the unmount hook**

Add before the inline application script:

```html
<script src="src/keyboard-shortcuts.js"></script>
```

Change the Vue destructuring to:

```js
const { createApp, ref, computed, onMounted, onUnmounted, nextTick, watch } = Vue;
```

- [ ] **Step 4: Add the minimal lifecycle-managed handler**

After `submitAnswer` is defined, add:

```js
const isKeyboardBlockingOverlayOpen = () =>
  showAnnouncement.value ||
  showUpdateLogs.value ||
  showExportModal.value ||
  showAuth.value ||
  showAccountModal.value ||
  showUserMenu.value;

const handleQuizKeydown = (event) => {
  const action = KeyboardShortcuts.resolveQuizKeyboardAction({
    key: event.key,
    target: event.target,
    isQuizActive: status.value === "quiz",
    isMemorizeMode: isMemorizeMode.value,
    hasSubmitted: hasSubmitted.value,
    isModalOpen: isKeyboardBlockingOverlayOpen(),
    isChoice: isChoice.value,
    isObjective: isObjective.value,
    availableOptions: KeyboardShortcuts.getAvailableShortcutOptions(currentQuestion.value),
    selectionCount: userSelection.value.length,
  });

  if (!action) return;
  event.preventDefault();

  if (action.type === "select") {
    selectOption(action.option);
  } else if (action.type === "submit") {
    submitAnswer();
  }
};

onMounted(() => window.addEventListener("keydown", handleQuizKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleQuizKeydown));
```

- [ ] **Step 5: Run all automated tests**

Run: `node --test tests/*.test.js`

Expected: all existing export tests and all new keyboard tests pass with zero failures.

- [ ] **Step 6: Run static checks**

Run: `node --check src/keyboard-shortcuts.js`

Expected: exit code 0 with no syntax errors.

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

- [ ] **Step 7: Commit the Vue integration**

```powershell
git add -- index.html tests/keyboard-shortcuts.test.js
git commit -m "feat: enable keyboard answer shortcuts"
```

### Task 3: Browser Interaction Verification

**Files:**
- Verify only: `index.html`, `src/keyboard-shortcuts.js`

**Interfaces:**
- Consumes: the completed browser behavior from Tasks 1–2.
- Produces: verification evidence; no new production API.

- [ ] **Step 1: Start the existing local static preview**

Use the repository's established preview command if documented; otherwise run a local static HTTP server without modifying repository files.

Expected: `index.html` loads with no console errors.

- [ ] **Step 2: Verify a multi-select question**

In the browser:

1. Start a quiz containing a multi-select question.
2. Press `A`; verify A is selected.
3. Press `A` again; verify A is deselected.
4. Press two distinct available keys among A–D; verify both are selected.

- [ ] **Step 3: Verify submission and post-submit behavior**

1. With at least one objective answer selected, press `Enter`.
2. Verify answer feedback appears.
3. Record the current question identity.
4. Press `Enter` again.
5. Verify the question identity does not change and scoring is not repeated.

- [ ] **Step 4: Verify blocked contexts**

1. Open the export dialog and press A/Enter; verify the answer state does not change.
2. Focus an input or textarea and type A plus Enter; verify normal field behavior and no answer change.
3. Open a subjective question textarea, press Enter, and verify it inserts a newline rather than submitting.

- [ ] **Step 5: Re-run final verification**

Run: `node --test tests/*.test.js`

Expected: zero failures.

Run: `node --check src/keyboard-shortcuts.js`

Expected: exit code 0.

Run: `git status --short`

Expected: no unintended files; only any explicitly uncommitted verification artifacts may appear, and those should not be committed.
