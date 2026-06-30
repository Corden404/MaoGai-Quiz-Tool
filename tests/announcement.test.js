const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("latest announcement explains quiz page experience improvements", () => {
  const listStart = html.indexOf("const announcementsList = [");
  const versionSix = html.indexOf("version: 6", listStart);
  const versionFive = html.indexOf("version: 5", listStart);

  assert.ok(versionSix > listStart, "version 6 announcement should exist");
  assert.ok(versionSix < versionFive, "version 6 should be the latest announcement");
  assert.match(html, /title: "📱 刷题页体验优化"/);
  assert.match(html, /date: "2026-06-30"/);
  assert.match(html, /本次更新优化了刷题页的移动端和桌面端使用体验/);
  assert.match(html, /新增答题卡：可查看当前练习的已做\/未做进度，并快速跳转到指定题目。/);
  assert.match(html, /新增滑动切题：移动端可左右滑动切换上一题\/下一题，纵向滚动和文字输入不受影响。/);
});
