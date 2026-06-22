# Enter 进入下一题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在题目已经显示作答结果或参考答案后，让 `Enter` 复用现有下一题流程。

**Architecture:** 扩展纯函数键盘动作解析器，使其在 `hasSubmitted` 或主观题已自评时返回 `next`；Vue 页面只负责把 `next` 委派给现有 `nextQuestion()`。提交、翻题、保存进度和最后一题结束逻辑均不重复实现。

**Tech Stack:** 浏览器 JavaScript、Vue 3 CDN、Node.js 内置测试运行器。

## Global Constraints

- 直接在 `main` 上修改，不创建新分支。
- 背题模式、弹窗打开、输入控件或可编辑区域聚焦时不处理快捷键。
- 未显示答案时保留现有 `Enter` 提交行为。
- 最后一题复用 `nextQuestion()` 进入结果页。

---

### Task 1: 扩展键盘动作并接入下一题流程

**Files:**
- Modify: `tests/keyboard-shortcuts.test.js`
- Modify: `src/keyboard-shortcuts.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `resolveQuizKeyboardAction(context)`、`nextQuestion()`
- Produces: `resolveQuizKeyboardAction(context): null | { type: "select", option: string } | { type: "submit" } | { type: "next" }`

- [x] **Step 1: 写失败测试**

在 `tests/keyboard-shortcuts.test.js` 中断言：

```js
test("moves to the next question with Enter after an answer is revealed", () => {
  assert.deepEqual(
    resolveQuizKeyboardAction({ ...baseContext, key: "Enter", hasSubmitted: true }),
    { type: "next" },
  );
  assert.deepEqual(
    resolveQuizKeyboardAction({
      ...baseContext,
      key: "Enter",
      isObjective: false,
      selectionCount: 0,
      subjectiveStatus: "correct",
    }),
    { type: "next" },
  );
});
```

同时从阻断状态测试中移除 `hasSubmitted: true`，增加页面集成断言：

```js
assert.match(html, /subjectiveStatus:\s*subjectiveStatus\.value/);
assert.match(html, /else if \(action\.type === "next"\)\s*\{\s*nextQuestion\(\);/);
```

- [x] **Step 2: 运行测试并确认按预期失败**

Run: `node --test tests/keyboard-shortcuts.test.js`

Expected: 新增测试因已提交状态仍返回 `null`，页面尚未处理 `next` 而失败。

- [x] **Step 3: 写最小实现**

在 `src/keyboard-shortcuts.js` 中保留全局阻断条件，但把结果显示状态移到 `Enter` 分支：

```js
const subjectiveStatus = context.subjectiveStatus || "pending";
const answerRevealed =
  context.hasSubmitted || subjectiveStatus !== "pending";

if (context.key === "Enter") {
  if (answerRevealed) return { type: "next" };
  return context.isObjective && context.selectionCount > 0
    ? { type: "submit" }
    : null;
}

if (answerRevealed) return null;
```

在 `index.html` 的上下文中传入：

```js
subjectiveStatus: subjectiveStatus.value,
```

并在动作委派中增加：

```js
} else if (action.type === "next") {
  nextQuestion();
}
```

- [x] **Step 4: 运行目标测试并确认通过**

Run: `node --test tests/keyboard-shortcuts.test.js`

Expected: 全部快捷键测试通过。

- [x] **Step 5: 运行完整验证**

Run: `node --test tests/*.test.js`

Expected: 全部测试通过，失败数为 0。

Run: `node --check src/keyboard-shortcuts.js`

Expected: 退出码为 0。

Run: `git diff --check`

Expected: 无输出，退出码为 0。

- [ ] **Step 6: 提交实现**

```bash
git add tests/keyboard-shortcuts.test.js src/keyboard-shortcuts.js index.html docs/superpowers/plans/2026-06-23-enter-next-question.md
git commit -m "feat: advance quiz with enter after grading"
```
