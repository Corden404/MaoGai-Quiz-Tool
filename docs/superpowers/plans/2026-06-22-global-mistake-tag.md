# Global Mistake Question Tag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move global mistakes from quiz order into the OR-combined question tags and display the four setup sections side by side on desktop.

**Architecture:** Extend the pure `QuestionTags` module so `global_mistake` can match against a supplied set of cloud question IDs alongside local tags. In Vue, fetch cloud IDs only when that tag is selected, pass them into the pure filter, then apply randomization; update the setup grid to four columns and keep all controls inside their corresponding cards.

**Tech Stack:** Vanilla JavaScript, Vue 3 Composition API from CDN, Tailwind CSS, Node.js built-in `node:test`, Supabase RPC.

## Global Constraints

- Desktop setup layout is four columns: chapters, types, quiz order, question tags.
- Quiz order contains only `sequence` and `random`.
- Question tags contain `all`, `mistake`, `global_mistake`, `star`, `key`, and `hard`.
- `all` remains mutually exclusive with all specific tags.
- Specific tags use OR semantics and deduplicate questions.
- Global mistakes use IDs returned by `get_high_error_questions`.
- Selecting global mistakes without a cloud client shows the existing cloud-unavailable error and does not start the quiz.
- Randomization happens after all tag matching.
- Do not change stored progress or cloud schemas.

---

### Task 1: Extend Pure Tag Matching

**Files:**
- Modify: `tests/question-tags.test.js`
- Modify: `src/question-tags.js`

**Interfaces:**
- `matchesQuestionTags(question, tags, minMistakeCount, globalMistakeIds): boolean`
- `filterQuestionsByTags(questions, tags, minMistakeCount, globalMistakeIds): object[]`
- `globalMistakeIds` accepts a `Set`, array, or omitted value.

- [ ] Write failing tests that normalize `global_mistake`, include its label, match supplied IDs with OR semantics, and avoid duplicates.
- [ ] Run `node --test tests/question-tags.test.js`; expect failures because the tag is not supported.
- [ ] Add `global_mistake` to the ordered tags and labels, normalize IDs into a set, and match by `question.id`.
- [ ] Run the pure tests and expect zero failures.
- [ ] Commit with `feat: support global mistake question tag`.

### Task 2: Four-Column UI and Cloud OR Pipeline

**Files:**
- Modify: `tests/question-tags-ui.test.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `style.css` through `npm.cmd run build`

**Interfaces:**
- `mode` only contains `sequence` or `random`.
- `questionTagOptions` contains six entries including `global_mistake`.
- `startQuiz` optionally fetches cloud IDs, then calls:

```js
QuestionTags.filterQuestionsByTags(
  filtered,
  selectedQuestionTags.value,
  safeMistakeMinCount,
  globalMistakeIds,
);
```

- [ ] Write failing UI tests for `md:grid-cols-4`, two quiz-order values, the global-mistake tag and conditional threshold, and cloud fetch before shared tag filtering.
- [ ] Run `node --test tests/question-tags-ui.test.js`; expect failures against the current three-column/global-mode implementation.
- [ ] Change the desktop grid to four columns and remove the question-tag card span.
- [ ] Move `global_mistake` into `questionTagOptions`, remove it from mode cards/labels, and conditionally render its threshold inside the tag card.
- [ ] Refactor `startQuiz` to fetch cloud IDs when selected, preserve cloud result order metadata, OR-filter through `QuestionTags`, and randomize afterward.
- [ ] Update guide/README copy to describe two quiz orders and six combinable tags.
- [ ] Run `npm.cmd run build`.
- [ ] Run `node --test tests/*.test.js`, `node --check src/question-tags.js`, and `git diff --check`.
- [ ] Commit with `feat: move global mistakes into question tags`.

### Task 3: Preview Verification

**Files:**
- Verify: `index.html`, `style.css`, `src/question-tags.js`

- [ ] Start the localhost preview and open a cache-busted URL.
- [ ] Verify desktop shows four parallel cards and mobile stacks them.
- [ ] Verify global-mistake threshold visibility and multi-tag selection behavior.
- [ ] Verify a global-mistake plus local-tag selection uses OR semantics.
- [ ] Run the full automated verification again before completion.
