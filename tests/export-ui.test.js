const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

test("export entry lives in the top navigation and opens a modal", () => {
  assert.match(html, /@click="showExportModal = true"/);
  assert.match(html, /v-if="showExportModal"/);
  assert.match(html, /导出错题/);
});

test("export entry is green without the selected-looking frame", () => {
  const match = html.match(/<button @click="showExportModal = true"\s+class="([^"]+)"/);

  assert.ok(match, "export button should exist");
  assert.match(match[1], /nav-export-button/);
  assert.doesNotMatch(match[1], /\bborder\b/);
});

test("export entry stays understandable on mobile", () => {
  assert.match(html, /aria-label="导出错题"/);
  assert.match(html, /<span class="nav-export-label">导出错题<\/span>/);
  assert.doesNotMatch(html, /<span class="sm:hidden">导出<\/span>/);
  assert.doesNotMatch(html, /<span class="hidden sm:inline">导出错题<\/span>/);
});

test("top navigation keeps the original single-row structure", () => {
  assert.match(html, /glass-nav sticky top-0 z-50 flex justify-between items-center/);
  assert.doesNotMatch(html, /glass-nav sticky top-0 z-50 flex flex-wrap/);
  assert.match(html, /class="nav-tools flex items-center gap-2"/);
});

test("export entry sits with the utility controls instead of crowding the title", () => {
  assert.match(html, /<div class="flex items-center gap-2\.5">\s*<span class="text-xl">📖<\/span>\s*<span class="nav-title-text[^"]*">思政刷题助手<\/span>\s*<\/div>/);
  assert.match(html, /<div class="nav-tools flex items-center gap-2">[\s\S]*?<button @click="showExportModal = true"/);
});

test("export formats are selected from the modal", () => {
  assert.match(html, /@click="handleExportFormat\('pdf'\)"/);
  assert.match(html, /@click="handleExportFormat\('markdown'\)"/);
  assert.match(html, /@click="handleExportFormat\('txt'\)"/);
  assert.doesNotMatch(html, /@click="exportMistakes\('[^']+'\); showExportModal = false"/);
});

test("export modal only closes after a successful export", () => {
  assert.match(html, /const handleExportFormat = async \(format\) => \{/);
  assert.match(html, /if \(await exportMistakes\(format\)\) \{/);
  assert.match(html, /showExportModal\.value = false;/);
  assert.match(html, /return false;/);
  assert.match(html, /return true;/);
});

test("pdf export lazy-loads the generator before falling back to the print page", () => {
  assert.doesNotMatch(html, /<script[^>]+html2pdf\.bundle\.min\.js[^>]*><\/script>/);
  assert.match(html, /const loadHtml2pdfLibrary = \(\) => \{/);
  assert.match(html, /document\.createElement\("script"\)/);
  assert.match(html, /html2pdf\.bundle\.min\.js/);
  assert.match(html, /const exportMistakes = async \(format\) => \{/);
  assert.match(html, /await loadHtml2pdfLibrary\(\)/);
  assert.match(html, /html2pdf\(\)\.set\(/);
  assert.match(html, /const pdfSource = element\.querySelector\("\.page"\) \|\| element;/);
  assert.match(html, /\.from\(pdfSource\)\.save\(`\$\{filenameBase\}\.pdf`\)/);
  assert.doesNotMatch(html, /\.from\(element\)\.save\(`\$\{filenameBase\}\.pdf`\)/);
  assert.match(html, /const printHtml = exporter\.formatMistakesPrintHtml\(questions, meta\)/);
  assert.match(html, /openPrintExportWindow\(printHtml\)/);
});

test("export modal lets users choose multiple export scopes and mistake threshold", () => {
  assert.match(html, /toggleExportScope\(option\.value\)/);
  assert.match(html, /exportScopes\.includes\(option\.value\)/);
  assert.match(html, /v-if="exportScopes\.includes\('mistake'\)"/);
  assert.match(html, /v-model\.number="exportMistakeMinCount"/);
  assert.match(html, /错题/);
  assert.match(html, /星标/);
  assert.match(html, /重点/);
  assert.match(html, /难记/);
});

test("export modal keeps content and sort controls without the bulky preview list", () => {
  assert.match(html, /共 \$\{exportQuestionCount\.value\} 题/);
  assert.doesNotMatch(html, /预计导出：\{\{ exportQuestionCount \}\} 题/);
  assert.doesNotMatch(html, /exportPreviewQuestions/);
  assert.doesNotMatch(html, /export-preview-card/);
  assert.match(html, /exportContentOptions/);
  assert.match(html, /exportSortOptions/);
  assert.match(html, /exportContentLevel/);
  assert.match(html, /exportSortMode/);
  assert.match(html, /题目\+答案\+笔记/);
  assert.match(html, /按错题次数/);
});

test("export modal format buttons use explicit dark readable button classes", () => {
  assert.match(html, /export-format-button export-format-button--primary/);
  assert.match(html, /export-format-button">/);
  assert.doesNotMatch(html, /导出为 Markdown[\s\S]{0,220}bg-slate-50/);
  assert.doesNotMatch(html, /导出为 TXT[\s\S]{0,220}bg-slate-50/);
});

test("export modal format buttons define separate light and dark palettes", () => {
  assert.match(html, /\.export-format-button\s*\{[\s\S]*background: #f8fafc;/);
  assert.match(html, /\.dark \.export-format-button\s*\{[\s\S]*background: rgba\(30, 41, 59, 0\.72\);/);
  assert.match(html, /\.export-format-button--primary\s*\{[\s\S]*background: #d1fae5;/);
  assert.match(html, /\.dark \.export-format-button--primary\s*\{[\s\S]*background: rgba\(6, 78, 59, 0\.42\);/);
});

test("setup page no longer contains the old inline export card", () => {
  assert.doesNotMatch(html, /<!-- 导出错题 -->[\s\S]*?title="导出为 PDF"/);
});
