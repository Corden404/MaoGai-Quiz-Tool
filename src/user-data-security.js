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

  const createEmptyProgress = () => ({
    tags: {},
    error_counts: {},
    notes: {},
    reported_questions: {},
  });

  const isPlainObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  const safeObject = (value) => (isPlainObject(value) ? value : {});

  const normalizeProgress = (value) => {
    const source = safeObject(value);
    const progress = {
      tags: safeObject(source.tags),
      error_counts: safeObject(source.error_counts),
      notes: safeObject(source.notes),
      reported_questions: safeObject(source.reported_questions),
    };
    if (Number.isFinite(source.last_updated)) {
      progress.last_updated = source.last_updated;
    }
    return progress;
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
    canSyncProgress,
    countCodePoints,
    createEmptyProgress,
    migrateLegacyProgress,
    progressStorageKey,
    readProgress,
    removeProgress,
    validateNoteContent,
    writeProgress,
  };
});
