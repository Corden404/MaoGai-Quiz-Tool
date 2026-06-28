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

  function resolveSwipeDragOffset({
    startX,
    startY,
    currentX,
    currentY,
    isBlocked = false,
    threshold = 8,
    dominanceRatio = 1.15,
    maxOffset = 120,
  } = {}) {
    if (isBlocked) return null;
    if (
      !Number.isFinite(startX) ||
      !Number.isFinite(startY) ||
      !Number.isFinite(currentX) ||
      !Number.isFinite(currentY)
    ) {
      return null;
    }

    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < threshold) return null;
    if (absX < absY * dominanceRatio) return null;

    const safeMaxOffset = Math.max(0, Number(maxOffset) || 0);
    const offsetX = Math.max(-safeMaxOffset, Math.min(safeMaxOffset, deltaX));

    return { isDragging: true, offsetX };
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
    resolveSwipeDragOffset,
    resolveSwipeAction,
    isSwipeIgnoredTarget,
  };
});
