const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("style.css", "utf8");

test("quiz exit control is a subdued red explicit button in light and dark modes", () => {
  const match = html.match(/<button @click="goToSetup"\s+class="([^"]+)">\s*退出\s*<\/button>/);

  assert.ok(match, "quiz exit control should render plain 退出 text");
  assert.match(match[1], /bg-red-50/);
  assert.match(match[1], /border-red-200/);
  assert.match(match[1], /text-red-700/);
  assert.match(match[1], /dark:bg-red-900\/20/);
  assert.match(match[1], /dark:border-red-900\/30/);
  assert.match(match[1], /dark:text-red-300/);
  assert.doesNotMatch(match[1], /bg-red-600/);
  assert.doesNotMatch(match[1], /text-white/);
  assert.match(css, /\.bg-red-50\{/);
  assert.match(css, /\.border-red-200\{/);
  assert.match(css, /\.text-red-700\{/);
  assert.match(css, /\.dark\\:bg-red-900\\\/20:is\(\.dark \*\)\{/);
  assert.match(css, /\.dark\\:border-red-900\\\/30:is\(\.dark \*\)\{/);
  assert.match(css, /\.dark\\:text-red-300:is\(\.dark \*\)\{/);
  assert.doesNotMatch(html, />\s*← 退出\s*</);
});
