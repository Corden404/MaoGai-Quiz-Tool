(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KeyboardShortcuts = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const SHORTCUT_OPTIONS = ["A", "B", "C", "D"];
  const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

  const getAvailableShortcutOptions = (question = {}) => {
    if (!question.options || typeof question.options !== "object") {
      return SHORTCUT_OPTIONS.slice();
    }
    return SHORTCUT_OPTIONS.filter((option) => Boolean(question.options[option]));
  };

  const isEditableTarget = (target) => {
    if (!target) return false;
    const tagName = String(target.tagName || "").toUpperCase();
    return EDITABLE_TAGS.has(tagName) || target.isContentEditable === true;
  };

  const resolveQuizKeyboardAction = (context = {}) => {
    if (
      !context.isQuizActive ||
      context.isMemorizeMode ||
      context.hasSubmitted ||
      context.isModalOpen ||
      isEditableTarget(context.target)
    ) {
      return null;
    }

    if (context.key === "Enter") {
      return context.isObjective && context.selectionCount > 0
        ? { type: "submit" }
        : null;
    }

    const option = String(context.key || "").toUpperCase();
    if (
      context.isChoice &&
      SHORTCUT_OPTIONS.includes(option) &&
      context.availableOptions.includes(option)
    ) {
      return { type: "select", option };
    }

    return null;
  };

  return {
    getAvailableShortcutOptions,
    isEditableTarget,
    resolveQuizKeyboardAction,
  };
});
