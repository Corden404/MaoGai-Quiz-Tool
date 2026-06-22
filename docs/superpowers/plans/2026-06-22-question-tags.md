# Question Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate mistake, star, key, and hard filters from quiz mode and let users build one OR-combined question set through a mandatory “4. 题目标签” selection.

**Architecture:** Add a small UMD module containing deterministic tag normalization, toggle, matching, and filtering rules so Node tests and the browser share the same behavior. Keep Vue responsible for reactive selection state and presentation, while `startQuiz` applies chapter/type filtering, optional global-mistake filtering, question-tag filtering, and optional randomization in that order.

**Tech Stack:** Vanilla JavaScript, Vue 3 Composition API from CDN, Tailwind utility classes, Node.js built-in `node:test`.

## Global Constraints

- “3. 刷题模式” contains only `sequence`, `random`, and `global_mistake`.
- “4. 题目标签” contains `all`, `mistake`, `star`, `key`, and `hard`.
- The default selection is exactly `["all"]`.
- At least one question tag is always selected.
- `all` is mutually exclusive with every specific tag.
- `mistake`, `star`, `key`, and `hard` may be selected together and use OR matching.
- Selecting a specific tag removes `all`; selecting `all` removes every specific tag.
- Removing the final specific tag restores `all`.
- A question matching several selected tags appears only once.
- The mistake threshold is at least 1 and applies only to the `mistake` tag.
- Quiz mode and question tags compose by intersection; randomization happens after tag filtering.
- Do not change stored user progress, question tag fields, answer-page tag controls, exports, or cloud schemas.
- Do not add dependencies.

---

## File Structure

- Create `src/question-tags.js`: pure normalization, toggle, label, match, and filter functions exposed as `QuestionTags` in the browser and through CommonJS in Node.
- Create `tests/question-tags.test.js`: behavior tests for mandatory selection, mutual exclusion, OR matching, mistake thresholds, and deduplication by single-pass filtering.
- Create `tests/question-tags-ui.test.js`: static integration contract for script loading, setup-page structure, Vue state, filtering order, summary, and tour copy.
- Modify `index.html`: remove the four filters from quiz mode, render the new fourth section, hold tag state, delegate tag changes/filtering to `QuestionTags`, update the summary and onboarding tour.
- Modify `README.md`: describe quiz modes and combinable question tags separately.

### Task 1: Pure Question-Tag Rules

**Files:**
- Create: `tests/question-tags.test.js`
- Create: `src/question-tags.js`

**Interfaces:**
- Consumes: arrays of tag IDs, question objects using `error_count`, `tag_star`, `tag_key`, and `tag_hard`, plus a numeric mistake threshold.
- Produces:
  - `normalizeQuestionTags(tags): string[]`
  - `toggleQuestionTag(tags, tag): string[]`
  - `matchesQuestionTags(question, tags, minMistakeCount): boolean`
  - `filterQuestionsByTags(questions, tags, minMistakeCount): object[]`
  - `getQuestionTagSummary(tags): string`

- [ ] **Step 1: Write failing tests for normalization and mandatory selection**

Create `tests/question-tags.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  filterQuestionsByTags,
  getQuestionTagSummary,
  matchesQuestionTags,
  normalizeQuestionTags,
  toggleQuestionTag,
} = require("../src/question-tags.js");

test("normalizes empty and all-inclusive selections to all only", () => {
  assert.deepEqual(normalizeQuestionTags([]), ["all"]);
  assert.deepEqual(normalizeQuestionTags(["all", "mistake", "star"]), ["all"]);
  assert.deepEqual(normalizeQuestionTags(["unknown"]), ["all"]);
});

test("keeps unique valid specific tags in display order", () => {
  assert.deepEqual(
    normalizeQuestionTags(["hard", "star", "hard", "mistake"]),
    ["mistake", "star", "hard"],
  );
});

test("selecting a specific tag removes all and selecting all clears specifics", () => {
  assert.deepEqual(toggleQuestionTag(["all"], "mistake"), ["mistake"]);
  assert.deepEqual(toggleQuestionTag(["mistake", "star"], "all"), ["all"]);
});

test("removing the last specific tag restores all", () => {
  assert.deepEqual(toggleQuestionTag(["mistake"], "mistake"), ["all"]);
  assert.deepEqual(toggleQuestionTag(["mistake", "star"], "mistake"), ["star"]);
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `node --test tests/question-tags.test.js`

Expected: FAIL with `Cannot find module '../src/question-tags.js'`.

- [ ] **Step 3: Add failing tests for OR matching, threshold handling, and summaries**

Append to `tests/question-tags.test.js`:

```js
const questions = [
  { id: "mistake", error_count: 2 },
  { id: "star", error_count: 0, tag_star: true },
  { id: "key-hard", error_count: 0, tag_key: true, tag_hard: true },
  { id: "plain", error_count: 0 },
];

test("all matches every question while specific tags use OR semantics", () => {
  assert.equal(matchesQuestionTags(questions[3], ["all"], 1), true);
  assert.deepEqual(
    filterQuestionsByTags(questions, ["mistake", "star"], 1).map((question) => question.id),
    ["mistake", "star"],
  );
  assert.deepEqual(
    filterQuestionsByTags(questions, ["star", "key", "hard"], 1).map((question) => question.id),
    ["star", "key-hard"],
  );
});

test("mistake matching clamps the threshold to at least one", () => {
  assert.equal(matchesQuestionTags({ error_count: 0 }, ["mistake"], 0), false);
  assert.equal(matchesQuestionTags({ error_count: 2 }, ["mistake"], 3), false);
  assert.equal(matchesQuestionTags({ error_count: 3 }, ["mistake"], 3), true);
});

test("a question matching multiple tags is returned only once", () => {
  const result = filterQuestionsByTags(
    [{ id: "combined", error_count: 4, tag_star: true, tag_key: true }],
    ["mistake", "star", "key"],
    1,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "combined");
});

test("builds a readable normalized selection summary", () => {
  assert.equal(getQuestionTagSummary(["all"]), "所有题目");
  assert.equal(getQuestionTagSummary(["hard", "mistake", "star"]), "错题巩固、星标练习、难记练习");
});
```

- [ ] **Step 4: Implement the minimal UMD module**

Create `src/question-tags.js`:

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.QuestionTags = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const ALL_TAG = "all";
  const SPECIFIC_TAGS = ["mistake", "star", "key", "hard"];
  const TAG_LABELS = {
    all: "所有题目",
    mistake: "错题巩固",
    star: "星标练习",
    key: "重点练习",
    hard: "难记练习",
  };

  const normalizeQuestionTags = (tags) => {
    const rawTags = Array.isArray(tags) ? tags : [];
    if (rawTags.includes(ALL_TAG)) return [ALL_TAG];
    const normalized = SPECIFIC_TAGS.filter((tag) => rawTags.includes(tag));
    return normalized.length ? normalized : [ALL_TAG];
  };

  const toggleQuestionTag = (tags, tag) => {
    const current = normalizeQuestionTags(tags);
    if (tag === ALL_TAG) return [ALL_TAG];
    if (!SPECIFIC_TAGS.includes(tag)) return current;

    const specifics = current.filter((value) => value !== ALL_TAG);
    if (specifics.includes(tag)) {
      return normalizeQuestionTags(specifics.filter((value) => value !== tag));
    }
    return normalizeQuestionTags([...specifics, tag]);
  };

  const normalizeMistakeMinCount = (value) => Math.max(1, Number(value || 1));

  const matchesQuestionTags = (question, tags, minMistakeCount = 1) => {
    const normalized = normalizeQuestionTags(tags);
    if (normalized.includes(ALL_TAG)) return true;

    const minCount = normalizeMistakeMinCount(minMistakeCount);
    return normalized.some((tag) => {
      if (tag === "mistake") return Number(question?.error_count || 0) >= minCount;
      if (tag === "star") return Boolean(question?.tag_star);
      if (tag === "key") return Boolean(question?.tag_key);
      if (tag === "hard") return Boolean(question?.tag_hard);
      return false;
    });
  };

  const filterQuestionsByTags = (questions, tags, minMistakeCount = 1) =>
    (Array.isArray(questions) ? questions : []).filter((question) =>
      matchesQuestionTags(question, tags, minMistakeCount),
    );

  const getQuestionTagSummary = (tags) =>
    normalizeQuestionTags(tags).map((tag) => TAG_LABELS[tag]).join("、");

  return {
    filterQuestionsByTags,
    getQuestionTagSummary,
    matchesQuestionTags,
    normalizeQuestionTags,
    toggleQuestionTag,
  };
});
```

- [ ] **Step 5: Run the pure tests and verify GREEN**

Run: `node --test tests/question-tags.test.js`

Expected: 8 tests pass, 0 fail.

- [ ] **Step 6: Run syntax and whitespace checks**

Run: `node --check src/question-tags.js`

Expected: exit code 0 with no output.

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

- [ ] **Step 7: Commit the pure rules**

```powershell
git add -- src/question-tags.js tests/question-tags.test.js
git commit -m "feat: add combinable question tag rules"
```

### Task 2: Setup-Page State and Controls

**Files:**
- Create: `tests/question-tags-ui.test.js`
- Modify: `index.html:50-60`
- Modify: `index.html:1045-1130`
- Modify: `index.html:2100-2140`
- Modify: `index.html:3075-3170`

**Interfaces:**
- Consumes:
  - `QuestionTags.toggleQuestionTag(tags, tag)` from Task 1.
  - `QuestionTags.getQuestionTagSummary(tags)` from Task 1.
- Produces:
  - `selectedQuestionTags: Ref<string[]>`, initialized to `["all"]`.
  - `questionTagOptions: Array<{ value: string, label: string, icon: string }>`
  - `toggleQuestionFilterTag(tag): void`
  - `selectedQuestionTagSummary: ComputedRef<string>`

- [ ] **Step 1: Write failing static UI tests**

Create `tests/question-tags-ui.test.js`:

```js
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
  assert.match(html, /\{\{ modeLabels\[mode\] \|\| mode \}\} · \{\{ selectedQuestionTagSummary \}\}/);
  assert.match(html, /QuestionTags\.getQuestionTagSummary/);
});
```

- [ ] **Step 2: Run the UI tests and verify RED**

Run: `node --test tests/question-tags-ui.test.js`

Expected: FAIL because `index.html` does not load `question-tags.js` or contain a fourth setup section.

- [ ] **Step 3: Load the module and narrow the mode definitions**

Before the main inline application script, add:

```html
<script src="src/question-tags.js"></script>
```

Replace the mode card data with:

```html
v-for="m in [{val:'sequence', label:'顺序练习', icon:'📋'}, {val:'random', label:'随机抽题', icon:'🔀'}, {val:'global_mistake', label:'全网易错', icon:'🔥'}]"
```

Remove the old `mode === 'mistake'` threshold block.

Replace `modeLabels` with:

```js
const modeLabels = {
  sequence: "顺序练习",
  random: "随机抽题",
  global_mistake: "全网易错",
};
```

- [ ] **Step 4: Add the reactive question-tag state and handlers**

Beside the existing mode state, add:

```js
const selectedQuestionTags = ref(["all"]);
const questionTagOptions = [
  { value: "all", label: "所有题目", icon: "📚" },
  { value: "mistake", label: "错题巩固", icon: "❌" },
  { value: "star", label: "星标练习", icon: "⭐" },
  { value: "key", label: "重点练习", icon: "📌" },
  { value: "hard", label: "难记练习", icon: "🧠" },
];
const selectedQuestionTagSummary = computed(() =>
  QuestionTags.getQuestionTagSummary(selectedQuestionTags.value),
);
```

Beside `toggleSelection`, add:

```js
const toggleQuestionFilterTag = (tag) => {
  selectedQuestionTags.value = QuestionTags.toggleQuestionTag(
    selectedQuestionTags.value,
    tag,
  );
};
```

Expose these values from `setup()`:

```js
selectedQuestionTags,
questionTagOptions,
selectedQuestionTagSummary,
toggleQuestionFilterTag,
```

- [ ] **Step 5: Render the fourth setup section**

After the closing element for “3. 刷题模式”, add:

```html
<!-- ④ 题目标签 -->
<div id="guide-question-tags"
  class="section-card bg-white dark:bg-surface-800 p-4 sm:p-5 border border-slate-200/60 dark:border-slate-700/40 shadow-sm">
  <h3 class="font-bold text-slate-800 dark:text-slate-100 mb-3 sm:mb-4 flex items-center gap-2">
    <span class="text-brand-500 font-extrabold">4.</span> 题目标签
  </h3>
  <div class="grid grid-cols-3 sm:grid-cols-2 gap-2 sm:gap-2.5">
    <button v-for="tag in questionTagOptions" :key="tag.value"
      @click="toggleQuestionFilterTag(tag.value)"
      :aria-pressed="selectedQuestionTags.includes(tag.value)"
      :class="selectedQuestionTags.includes(tag.value)
        ? 'border-brand-500 dark:border-brand-500/60 bg-brand-50/80 dark:bg-brand-900/15'
        : 'border-slate-200/80 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'"
      class="icon-card flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-2xl border-[1.5px] transition-all duration-200 cursor-pointer group">
      <div
        :class="selectedQuestionTags.includes(tag.value)
          ? 'bg-brand-500 text-white'
          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'"
        class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center text-lg sm:text-xl transition-colors">
        <span>{{ tag.icon }}</span>
      </div>
      <span class="text-[10px] sm:text-xs font-semibold text-center leading-tight"
        :class="selectedQuestionTags.includes(tag.value)
          ? 'text-brand-700 dark:text-brand-300'
          : 'text-slate-500 dark:text-slate-400'">
        {{ tag.label }}
      </span>
    </button>
  </div>
  <div v-if="selectedQuestionTags.includes('mistake')"
    class="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
    <span>错题次数 ≥</span>
    <input type="number" min="1" v-model.number="mistakeMinCount"
      class="border border-slate-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1 w-16 text-center outline-none focus:border-brand-500 transition" />
    <span>次</span>
  </div>
</div>
```

Update the selection summary to:

```html
已选择: {{ selectedChapters.length }}章节 · {{ selectedTypes.length }}题型 · {{ modeLabels[mode] || mode }} · {{ selectedQuestionTagSummary }}
```

- [ ] **Step 6: Run the UI and pure tests and verify GREEN**

Run: `node --test tests/question-tags.test.js tests/question-tags-ui.test.js`

Expected: all question-tag tests pass with zero failures.

- [ ] **Step 7: Run the full regression suite**

Run: `node --test tests/*.test.js`

Expected: all repository tests pass with zero failures.

- [ ] **Step 8: Commit the setup-page controls**

```powershell
git add -- index.html tests/question-tags-ui.test.js
git commit -m "feat: add question tag selector"
```

### Task 3: Compose Tag Filtering with Quiz Modes

**Files:**
- Modify: `tests/question-tags-ui.test.js`
- Modify: `index.html:2350-2450`

**Interfaces:**
- Consumes:
  - `selectedQuestionTags.value` from Task 2.
  - `QuestionTags.filterQuestionsByTags(questions, tags, minMistakeCount)` from Task 1.
- Produces: `startQuiz` queues questions in this exact pipeline:
  1. chapter/type base filtering,
  2. optional global-mistake intersection and ordering,
  3. OR-combined question-tag filtering,
  4. optional random shuffle and count limit.

- [ ] **Step 1: Add failing integration tests for the filtering pipeline**

Append to `tests/question-tags-ui.test.js`:

```js
test("applies question tags after global filtering and before randomization", () => {
  const startQuizStart = html.indexOf("const startQuiz = async");
  const startQuizEnd = html.indexOf("const loadQuestionState", startQuizStart);
  const startQuiz = html.slice(startQuizStart, startQuizEnd);
  const globalFilter = startQuiz.indexOf('if (mode.value === "global_mistake")');
  const tagFilter = startQuiz.indexOf("QuestionTags.filterQuestionsByTags");
  const randomFilter = startQuiz.indexOf('if (mode.value === "random")');

  assert.ok(globalFilter >= 0, "global mistake filtering should remain");
  assert.ok(tagFilter > globalFilter, "question tags should run after global filtering");
  assert.ok(randomFilter > tagFilter, "randomization should run after question tags");
  assert.match(startQuiz, /selectedQuestionTags\.value/);
  assert.match(startQuiz, /safeMistakeMinCount/);
});

test("removes legacy mutually exclusive mode branches", () => {
  assert.doesNotMatch(html, /mode\.value === "mistake"/);
  assert.doesNotMatch(html, /\["star", "key", "hard"\]\.includes\(mode\.value\)/);
});
```

- [ ] **Step 2: Run the integration tests and verify RED**

Run: `node --test tests/question-tags-ui.test.js`

Expected: FAIL because `startQuiz` still has mutually exclusive mistake/star/key/hard mode branches and no shared tag-filter call.

- [ ] **Step 3: Replace the legacy branches with shared tag filtering**

Keep the existing `safeMistakeMinCount` normalization. After the complete `global_mistake` block and before random handling, add:

```js
filtered = QuestionTags.filterQuestionsByTags(
  filtered,
  selectedQuestionTags.value,
  safeMistakeMinCount,
);
```

Delete:

```js
} else if (mode.value === "mistake") {
  filtered = filtered.filter((q) => (q.error_count || 0) >= safeMistakeMinCount);
  filtered.sort((a, b) => (b.error_count || 0) - (a.error_count || 0));
} else if (["star", "key", "hard"].includes(mode.value)) {
  const tagMap = {
    star: "tag_star",
    key: "tag_key",
    hard: "tag_hard",
  };
  const tagField = tagMap[mode.value];
  filtered = filtered.filter((q) => !!q[tagField]);
```

Change the random branch from an `else if` tied to global mode handling into an independent condition after tag filtering:

```js
if (mode.value === "random") {
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }
  const count = Number(randomCount.value) || 20;
  if (count < filtered.length) {
    filtered = filtered.slice(0, count);
  }
}
```

- [ ] **Step 4: Run the integration tests and verify GREEN**

Run: `node --test tests/question-tags-ui.test.js`

Expected: all UI integration tests pass with zero failures.

- [ ] **Step 5: Run pure and full regression tests**

Run: `node --test tests/question-tags.test.js tests/question-tags-ui.test.js`

Expected: all question-tag tests pass.

Run: `node --test tests/*.test.js`

Expected: all repository tests pass with zero failures.

- [ ] **Step 6: Run syntax and whitespace checks**

Run: `node --check src/question-tags.js`

Expected: exit code 0.

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

- [ ] **Step 7: Commit the composed queue filtering**

```powershell
git add -- index.html tests/question-tags-ui.test.js
git commit -m "feat: combine quiz modes with question tags"
```

### Task 4: User-Facing Copy and Browser Verification

**Files:**
- Modify: `tests/question-tags-ui.test.js`
- Modify: `index.html:1630-1715`
- Modify: `README.md:17-23`

**Interfaces:**
- Consumes: completed setup-page behavior from Tasks 1–3.
- Produces: accurate onboarding/README descriptions and browser verification evidence; no new production API.

- [ ] **Step 1: Add failing tests for onboarding and README copy**

Append to `tests/question-tags-ui.test.js`:

```js
const readme = fs.readFileSync("README.md", "utf8");

test("onboarding teaches modes and combinable question tags separately", () => {
  assert.match(html, /element: '#guide-mode'[\s\S]*顺序、随机和全网易错/);
  assert.match(html, /element: '#guide-question-tags'[\s\S]*可同时选择多个/);
});

test("README describes combinable OR-style question tags", () => {
  assert.match(readme, /顺序练习、随机抽题和全网易错/);
  assert.match(readme, /错题、星标、重点和难记标签可同时选择/);
  assert.match(readme, /命中任一所选标签/);
});
```

- [ ] **Step 2: Run the copy tests and verify RED**

Run: `node --test tests/question-tags-ui.test.js`

Expected: FAIL because the current onboarding and README still describe mistake/tag practice as quiz modes.

- [ ] **Step 3: Update onboarding tour steps**

Replace the existing mode tour entry with:

```js
{
  element: "#guide-mode",
  popover: {
    title: "3. 刷题模式",
    description: "选择顺序、随机和全网易错，决定题目队列的组织方式。",
  },
},
{
  element: "#guide-question-tags",
  popover: {
    title: "4. 题目标签",
    description: "可同时选择多个错题、星标、重点或难记标签，练习命中任一标签的题目。",
  },
},
```

Update the feature-list copy near the page footer so it no longer calls mistake/tag filters modes and states that specific tags can be combined.

- [ ] **Step 4: Update README feature copy**

Replace the relevant “智能刷题模式” bullets with:

```markdown
- 提供顺序练习、随机抽题和全网易错等刷题模式。
- 错题、星标、重点和难记标签可同时选择，一次练习所有命中任一所选标签的题目。
```

- [ ] **Step 5: Run all automated checks**

Run: `node --test tests/*.test.js`

Expected: all repository tests pass with zero failures.

Run: `node --check src/question-tags.js`

Expected: exit code 0.

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

- [ ] **Step 6: Commit copy updates**

```powershell
git add -- index.html README.md tests/question-tags-ui.test.js
git commit -m "docs: explain combinable question tags"
```

- [ ] **Step 7: Start the existing local preview**

Use the repository's established local static preview without modifying tracked files.

Expected: the setup page loads without console errors and displays four numbered selection sections.

- [ ] **Step 8: Verify selection behavior in the browser**

At desktop and mobile widths, verify:

1. “所有题目” is selected on first load.
2. Selecting “错题巩固” clears “所有题目” and reveals the minimum-count input.
3. Selecting “星标练习” keeps both mistake and star selected.
4. Clearing one of two specific tags keeps the other selected.
5. Clearing the final specific tag restores “所有题目”.
6. Selecting “所有题目” while specifics are active clears all specifics.
7. Selected and unselected cards remain readable in light and dark themes.

- [ ] **Step 9: Verify composed queues in the browser**

Using known locally tagged questions:

1. Start “顺序练习 + 错题巩固 + 星标练习”; verify every queued question is either above the mistake threshold or starred.
2. Verify a question satisfying both conditions appears once.
3. Start “随机抽题 + 重点练习 + 难记练习”; verify the queue is limited by the random count and every item is key or hard.
4. If cloud data is available, start “全网易错 + 星标练习”; verify every item belongs to the returned global list and is starred.
5. Choose a combination with no matches; verify the existing empty-result toast appears and the setup page remains active.
6. Verify the setup summary displays both the current mode and normalized selected-tag labels.

- [ ] **Step 10: Perform final verification**

Run: `node --test tests/*.test.js`

Expected: zero failures.

Run: `node --check src/question-tags.js`

Expected: exit code 0.

Run: `git diff --check`

Expected: exit code 0.

Run: `git status --short`

Expected: no unintended files or uncommitted implementation changes.
