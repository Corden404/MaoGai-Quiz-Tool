(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SwipeNavigation = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

  function resolveSwipeAction({
    startX,
    startY,
    endX,
    endY,
    isBlocked = false,
    threshold = 60,
    dominanceRatio = 1.4,
  } = {}) {
    if (isBlocked) return null;
    if (
      !Number.isFinite(startX) ||
      !Number.isFinite(startY) ||
      !Number.isFinite(endX) ||
      !Number.isFinite(endY)
    ) {
      return null;
    }

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < threshold) return null;
    if (absX < absY * dominanceRatio) return null;

    return deltaX < 0 ? "next" : "previous";
  }

  function isSwipeIgnoredTarget(target) {
    if (!target) return false;
    const tagName = String(target.tagName || "").toUpperCase();
    if (EDITABLE_TAGS.has(tagName) || target.isContentEditable === true) return true;
    if (typeof target.closest === "function") {
      return Boolean(target.closest("[data-swipe-ignore]"));
    }
    return false;
  }

  return {
    resolveSwipeAction,
    isSwipeIgnoredTarget,
  };
});
