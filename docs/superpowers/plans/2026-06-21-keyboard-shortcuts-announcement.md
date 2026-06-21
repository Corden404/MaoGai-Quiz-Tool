# Keyboard Shortcuts Announcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-facing update announcement that explains how to use the new keyboard answer shortcuts.

**Architecture:** Extend the existing `announcementsList` in `index.html` with a version 5 entry at the top. Protect the announcement metadata and user-focused wording with a lightweight Node text test.

**Tech Stack:** HTML, Vue 3 inline application data, Node.js built-in `node:test`.

## Global Constraints

- Version is `5`.
- Type is `update`.
- Title is `⌨️ 键盘答题更方便了`.
- Date is `2026-06-21`.
- Use the existing three-card update announcement style.
- Explain A–D selection/cancellation, Enter submission/current-question retention, and safe typing in notes or text answers.
- Do not include implementation terminology in the user-facing announcement.
- Do not modify keyboard shortcut behavior.

---

### Task 1: Add the User-Facing Announcement

**Files:**
- Modify: `index.html`
- Create: `tests/announcement.test.js`

**Interfaces:**
- Consumes: the existing `announcementsList` and latest-update selection logic.
- Produces: a new first list entry with `version: 5`.

- [ ] **Step 1: Write the failing announcement test**

Create `tests/announcement.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("latest announcement explains keyboard answer shortcuts to users", () => {
  const listStart = html.indexOf("const announcementsList = [");
  const versionFive = html.indexOf("version: 5", listStart);
  const versionFour = html.indexOf("version: 4", listStart);

  assert.ok(versionFive > listStart, "version 5 announcement should exist");
  assert.ok(versionFive < versionFour, "version 5 should be the latest announcement");
  assert.match(html, /title: "⌨️ 键盘答题更方便了"/);
  assert.match(html, /date: "2026-06-21"/);
  assert.match(html, /A \/ B \/ C \/ D/);
  assert.match(html, /再按一次相同按键/);
  assert.match(html, /Enter/);
  assert.match(html, /仍停留在当前题/);
  assert.match(html, /输入笔记或文字答案时/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/announcement.test.js`

Expected: FAIL because no version 5 announcement exists.

- [ ] **Step 3: Add the version 5 announcement**

Insert this entry before version 4:

```js
{
  version: 5,
  type: "update",
  title: "⌨️ 键盘答题更方便了",
  date: "2026-06-21",
  content: `
  <div class="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50 mb-3">
    <p class="font-bold text-indigo-700 dark:text-indigo-400 mb-1">🔤 快捷选择选项</p>
    <p>按键盘上的 <strong>A / B / C / D</strong>，即可快速选择对应选项；再按一次相同按键，即可取消选择。</p>
  </div>
  <div class="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/50 mb-3">
    <p class="font-bold text-emerald-700 dark:text-emerald-400 mb-1">↵ 一键提交答案</p>
    <p>选好答案后按 <strong>Enter</strong> 即可立即提交，提交后仍停留在当前题，方便查看答案和解析。</p>
  </div>
  <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50">
    <p class="font-bold text-amber-700 dark:text-amber-400 mb-1">✍️ 输入时不会误触</p>
    <p>输入笔记或文字答案时，可以正常使用键盘，不会误选选项或提交答案。</p>
  </div>
`
},
```

- [ ] **Step 4: Run all automated tests**

Run: `node --test tests/*.test.js`

Expected: all tests pass with zero failures.

- [ ] **Step 5: Run static diff checks**

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

- [ ] **Step 6: Commit**

```powershell
git add -- index.html tests/announcement.test.js
git commit -m "feat: add keyboard shortcut update announcement"
```
