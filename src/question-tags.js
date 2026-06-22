(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.QuestionTags = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const ALL_TAG = "all";
  const SPECIFIC_TAGS = ["mistake", "global_mistake", "star", "key", "hard"];
  const TAG_LABELS = {
    all: "所有题目",
    mistake: "错题巩固",
    global_mistake: "全网易错",
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

  const normalizeGlobalMistakeIds = (value) => {
    if (value instanceof Set) return value;
    return new Set(Array.isArray(value) ? value : []);
  };

  const matchesQuestionTags = (
    question,
    tags,
    minMistakeCount = 1,
    globalMistakeIds,
  ) => {
    const normalized = normalizeQuestionTags(tags);
    if (normalized.includes(ALL_TAG)) return true;

    const minCount = normalizeMistakeMinCount(minMistakeCount);
    const globalIds = normalizeGlobalMistakeIds(globalMistakeIds);
    return normalized.some((tag) => {
      if (tag === "mistake") return Number(question?.error_count || 0) >= minCount;
      if (tag === "global_mistake") return globalIds.has(question?.id);
      if (tag === "star") return Boolean(question?.tag_star);
      if (tag === "key") return Boolean(question?.tag_key);
      if (tag === "hard") return Boolean(question?.tag_hard);
      return false;
    });
  };

  const filterQuestionsByTags = (
    questions,
    tags,
    minMistakeCount = 1,
    globalMistakeIds,
  ) =>
    (Array.isArray(questions) ? questions : []).filter((question) =>
      matchesQuestionTags(question, tags, minMistakeCount, globalMistakeIds),
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
