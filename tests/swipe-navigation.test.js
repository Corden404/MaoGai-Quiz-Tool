const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isSwipeIgnoredTarget,
  resolveSwipeAction,
} = require("../src/swipe-navigation.js");

test("resolves strong horizontal swipes to previous and next actions", () => {
  assert.equal(
    resolveSwipeAction({ startX: 240, startY: 120, endX: 120, endY: 128 }),
    "next",
  );
  assert.equal(
    resolveSwipeAction({ startX: 120, startY: 120, endX: 245, endY: 114 }),
    "previous",
  );
});

test("ignores short, blocked, and mostly vertical gestures", () => {
  assert.equal(resolveSwipeAction({ startX: 100, startY: 100, endX: 140, endY: 102 }), null);
  assert.equal(resolveSwipeAction({ startX: 100, startY: 100, endX: 190, endY: 220 }), null);
  assert.equal(resolveSwipeAction({ startX: 240, startY: 100, endX: 120, endY: 105, isBlocked: true }), null);
});

test("detects editable and marked swipe-ignore targets", () => {
  assert.equal(isSwipeIgnoredTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isSwipeIgnoredTarget({ tagName: "INPUT" }), true);
  assert.equal(isSwipeIgnoredTarget({ isContentEditable: true, tagName: "DIV" }), true);
  assert.equal(
    isSwipeIgnoredTarget({
      tagName: "SPAN",
      closest(selector) {
        return selector === "[data-swipe-ignore]";
      },
    }),
    true,
  );
  assert.equal(isSwipeIgnoredTarget({ tagName: "DIV", closest: () => null }), false);
});
