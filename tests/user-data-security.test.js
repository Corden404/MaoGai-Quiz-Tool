const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MAX_NOTE_LENGTH,
  canSyncProgress,
  countCodePoints,
  createEmptyProgress,
  migrateLegacyProgress,
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
    tags: { q1: { isStarred: true } },
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
