(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.UserDataSecurity = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_NOTE_LENGTH = 2000;
  const LEGACY_PROGRESS_KEY = "maogai_progress_v1";
  const ANONYMOUS_PROGRESS_KEY = "maogai_progress_v2:anonymous";
  const USER_PROGRESS_KEY_PREFIX = "maogai_progress_v2:user:";
  const TAG_FIELDS = ["tag_star", "tag_key", "tag_hard"];
  const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  const createEmptyProgress = () => ({
    tags: {},
    error_counts: {},
    notes: {},
    reported_questions: {},
  });

  const isPlainObject = (value) => {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };

  const safeObject = (value) => (isPlainObject(value) ? value : {});

  const normalizeProgress = (value, knownQuestionIds) => {
    const source = safeObject(value);
    const progress = createEmptyProgress();
    const entries = (record) => Object.entries(safeObject(record)).filter(([id]) =>
      id.length > 0 && !UNSAFE_KEYS.has(id) && (!knownQuestionIds || knownQuestionIds.has(id)));
    for (const [id, value] of entries(source.tags)) {
      const tags = {};
      for (const field of TAG_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(safeObject(value), field) && typeof value[field] === "boolean") {
          tags[field] = value[field];
        }
      }
      if (Object.keys(tags).length) progress.tags[id] = tags;
    }
    for (const [id, count] of entries(source.error_counts)) {
      if (Number.isSafeInteger(count) && count >= 0) progress.error_counts[id] = count;
    }
    for (const [id, note] of entries(source.notes)) {
      if (typeof note === "string" && Array.from(note).length <= MAX_NOTE_LENGTH) progress.notes[id] = note;
    }
    for (const [id, reported] of entries(source.reported_questions)) {
      if (typeof reported === "boolean") progress.reported_questions[id] = reported;
    }
    if (Number.isSafeInteger(source.last_updated) && source.last_updated >= 0) {
      progress.last_updated = source.last_updated;
    }
    return progress;
  };

  // Only user-owned fields may be copied onto a question, even for raw callers.
  const applyQuestionProgress = (questions, value) => {
    const progress = normalizeProgress(value, new Set(questions.map((question) => question.id)));
    for (const question of questions) {
      for (const field of [...TAG_FIELDS, "error_count", "note"]) delete question[field];
      const tags = progress.tags[question.id] || {};
      for (const field of TAG_FIELDS) {
        if (typeof tags[field] === "boolean") question[field] = tags[field];
      }
      if (Object.prototype.hasOwnProperty.call(progress.error_counts, question.id)) {
        question.error_count = progress.error_counts[question.id];
      }
      if (Object.prototype.hasOwnProperty.call(progress.notes, question.id)) {
        question.note = progress.notes[question.id];
      }
    }
  };

  const countCodePoints = (value) => Array.from(String(value ?? "")).length;

  const validateNoteContent = (content, options = {}) => {
    const text = String(content ?? "");
    if (countCodePoints(text) > MAX_NOTE_LENGTH) {
      return {
        ok: false,
        message: `笔记不能超过 ${MAX_NOTE_LENGTH} 个字符。`,
      };
    }
    if (options.public && text.trim().length === 0) {
      return {
        ok: false,
        message: "公开笔记不能为空。",
      };
    }
    return { ok: true, message: "" };
  };

  const progressStorageKey = (userId) =>
    userId ? `${USER_PROGRESS_KEY_PREFIX}${userId}` : ANONYMOUS_PROGRESS_KEY;

  const migrateLegacyProgress = (storage) => {
    const legacyValue = storage.getItem(LEGACY_PROGRESS_KEY);
    if (legacyValue === null) return;

    if (storage.getItem(ANONYMOUS_PROGRESS_KEY) === null) {
      try {
        const parsed = JSON.parse(legacyValue);
        storage.setItem(ANONYMOUS_PROGRESS_KEY, JSON.stringify(normalizeProgress(parsed)));
      } catch {
        // A malformed legacy cache is discarded instead of being uploaded.
      }
    }
    storage.removeItem(LEGACY_PROGRESS_KEY);
  };

  const readProgress = (storage, userId) => {
    const stored = storage.getItem(progressStorageKey(userId));
    if (stored === null) return createEmptyProgress();
    try {
      return normalizeProgress(JSON.parse(stored));
    } catch {
      return createEmptyProgress();
    }
  };

  const writeProgress = (storage, userId, progress) => {
    storage.setItem(progressStorageKey(userId), JSON.stringify(normalizeProgress(progress)));
  };

  const removeProgress = (storage, userId) => {
    storage.removeItem(progressStorageKey(userId));
  };

  const canSyncProgress = (expectedUserId, currentUserId) =>
    Boolean(expectedUserId) && expectedUserId === currentUserId;

  return {
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
  };
});
