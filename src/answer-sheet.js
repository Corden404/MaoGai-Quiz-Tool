(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AnswerSheet = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function isQuestionAnswered(question, attempt) {
    if (!question || !question.id || !attempt) return false;
    return attempt.graded === true;
  }

  function getAnswerSheetSummary(queue, attempts) {
    const list = Array.isArray(queue) ? queue : [];
    const attemptMap = attempts && typeof attempts === "object" ? attempts : {};
    const answered = list.filter((question) =>
      isQuestionAnswered(question, attemptMap[question.id]),
    ).length;

    return {
      total: list.length,
      answered,
      unanswered: Math.max(0, list.length - answered),
    };
  }

  return {
    isQuestionAnswered,
    getAnswerSheetSummary,
  };
});
