const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("latest announcement explains keyboard answer shortcuts to users", () => {
  const listStart = html.indexOf("const announcementsList = [");
  const versionFive = html.indexOf("version: 5", listStart);
  const versionFour = html.indexOf("version: 4", listStart);

  assert.ok(versionFive > listStart, "version 5 announcement should exist");
  assert.ok(versionFive < versionFour, "version 5 should be the latest announcement");
  assert.match(html, /title: "⌨️ 键盘答题更方便了"/);
  assert.match(html, /date: "2026-06-21"/);
  assert.match(html, /A \/ B \/ C \/ D/);
  assert.match(html, /再按一次相同按键/);
  assert.match(html, /Enter/);
  assert.match(html, /仍停留在当前题/);
  assert.match(html, /输入笔记或文字答案时/);
});
