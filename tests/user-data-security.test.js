const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MAX_NOTE_LENGTH,
  applyQuestionProgress,
  canSyncProgress,
  countCodePoints,
  createEmptyProgress,
  migrateLegacyProgress,
  normalizeProgress,
  progressStorageKey,
  readProgress,
  removeProgress,
  validateNoteContent,
  writeProgress,
} = require("../src/user-data-security.js");

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("validates private and public notes by Unicode code points", () => {
  assert.equal(MAX_NOTE_LENGTH, 2000);
  assert.equal(countCodePoints("😀"), 1);
  assert.equal(validateNoteContent("", { public: false }).ok, true);
  assert.equal(validateNoteContent("a".repeat(2000), { public: false }).ok, true);
  assert.equal(validateNoteContent("a".repeat(2001), { public: false }).ok, false);
  assert.equal(validateNoteContent("😀".repeat(2000), { public: false }).ok, true);
  assert.equal(validateNoteContent("😀".repeat(2001), { public: false }).ok, false);
  assert.equal(validateNoteContent("   ", { public: true }).ok, false);
});

test("uses separate storage keys for anonymous and signed-in progress", () => {
  assert.equal(progressStorageKey(null), "maogai_progress_v2:anonymous");
  assert.equal(progressStorageKey("user-a"), "maogai_progress_v2:user:user-a");
  assert.notEqual(progressStorageKey("user-a"), progressStorageKey("user-b"));
});

test("migrates the legacy cache only to anonymous progress", () => {
  const legacyProgress = {
    tags: { q1: { tag_star: true } },
    error_counts: {},
    notes: {},
    reported_questions: {},
  };
  const storage = new MemoryStorage({
    maogai_progress_v1: JSON.stringify(legacyProgress),
  });

  migrateLegacyProgress(storage);

  assert.equal(storage.getItem("maogai_progress_v1"), null);
  assert.deepEqual(readProgress(storage, null), legacyProgress);
  assert.deepEqual(readProgress(storage, "user-a"), createEmptyProgress());
});

test("does not overwrite an existing anonymous cache during legacy migration", () => {
  const anonymousProgress = {
    tags: {},
    error_counts: { q1: 3 },
    notes: {},
    reported_questions: {},
  };
  const storage = new MemoryStorage({
    maogai_progress_v1: JSON.stringify({ tags: { legacy: {} } }),
    "maogai_progress_v2:anonymous": JSON.stringify(anonymousProgress),
  });

  migrateLegacyProgress(storage);

  assert.deepEqual(readProgress(storage, null), anonymousProgress);
  assert.equal(storage.getItem("maogai_progress_v1"), null);
});

test("keeps account caches isolated and supports scoped removal", () => {
  const storage = new MemoryStorage();
  const anonymous = { ...createEmptyProgress(), notes: { q1: "anonymous" } };
  const userA = { ...createEmptyProgress(), notes: { q1: "user-a" } };
  const userB = { ...createEmptyProgress(), notes: { q1: "user-b" } };

  writeProgress(storage, null, anonymous);
  writeProgress(storage, "user-a", userA);
  writeProgress(storage, "user-b", userB);

  assert.deepEqual(readProgress(storage, null), anonymous);
  assert.deepEqual(readProgress(storage, "user-a"), userA);
  assert.deepEqual(readProgress(storage, "user-b"), userB);

  removeProgress(storage, "user-a");

  assert.deepEqual(readProgress(storage, "user-a"), createEmptyProgress());
  assert.deepEqual(readProgress(storage, null), anonymous);
  assert.deepEqual(readProgress(storage, "user-b"), userB);
});

test("returns normalized empty progress for malformed or partial cache data", () => {
  const storage = new MemoryStorage({
    "maogai_progress_v2:user:broken": "{not-json",
    "maogai_progress_v2:user:partial": JSON.stringify({ notes: { q1: "note" } }),
  });

  assert.deepEqual(readProgress(storage, "broken"), createEmptyProgress());
  assert.deepEqual(readProgress(storage, "partial"), {
    tags: {},
    error_counts: {},
    notes: { q1: "note" },
    reported_questions: {},
  });
});

test("rejects delayed sync work after the active account changes", () => {
  assert.equal(canSyncProgress("user-a", "user-a"), true);
  assert.equal(canSyncProgress("user-a", "user-b"), false);
  assert.equal(canSyncProgress("user-a", null), false);
  assert.equal(canSyncProgress("", "user-a"), false);
});

test("normalizes nested progress without retaining unknown keys, types or aliases", () => {
  const raw = JSON.parse('{"tags":{"q1":{"tag_star":true,"tag_hard":"yes","answer":"B","__proto__":{"tag_key":true}},"unknown":{"tag_star":true},"constructor":{"tag_star":true}},"error_counts":{"q1":3,"q2":-1,"q3":1.5,"q4":9007199254740992},"notes":{"q1":"safe","q2":[]},"reported_questions":{"q1":true,"q2":"true"}}');
  raw.notes.q3 = "😀".repeat(2001);
  const clean = normalizeProgress(raw, new Set(["q1", "q2", "q3", "q4", "constructor"]));
  assert.deepEqual(clean, {
    tags: { q1: { tag_star: true } }, error_counts: { q1: 3 },
    notes: { q1: "safe" }, reported_questions: { q1: true },
  });
  raw.tags.q1.tag_star = false;
  assert.equal(clean.tags.q1.tag_star, true);
});

test("local and cloud payloads cannot alter question identity, content or prototypes across accounts", () => {
  const raw = JSON.parse('{"tags":{"q1":{"id":"q2","answer":"B","question_content":"injected","options":{"A":"injected"},"constructor":{},"__proto__":{"polluted":true},"tag_star":true}},"notes":{"q1":"private"}}');
  const storage = new MemoryStorage({ [progressStorageKey("user-a")]: JSON.stringify(raw) });
  for (const progress of [raw, readProgress(storage, "user-a")]) {
    const question = { id: "q1", answer: "A", question_content: "original", options: { A: "safe" } };
    const original = structuredClone(question);
    applyQuestionProgress([question], progress);
    assert.equal(question.tag_star, true);
    assert.equal(question.note, "private");
    assert.equal(question.id, original.id);
    assert.equal(question.answer, original.answer);
    assert.equal(question.question_content, original.question_content);
    assert.deepEqual(question.options, original.options);
    assert.equal(Object.getPrototypeOf(question), Object.prototype);
    applyQuestionProgress([question], readProgress(storage, "user-b"));
    assert.deepEqual(question, original);
  }
});
