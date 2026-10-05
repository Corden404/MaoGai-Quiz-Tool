const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const manifest = require("../scripts/runtime-integrity.json");
const html = fs.readFileSync("index.html", "utf8");

test("every external startup resource is versioned and integrity-checked", () => {
  const tags = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(https?:\/\/[^\"]+)"[^>]*>/g)];
  assert.equal(tags.length, 4);
  for (const [tag, url] of tags) {
    const asset = Object.values(manifest).find(entry => entry.url === url);
    assert.ok(asset, `Unreviewed external resource ${url}`);
    assert.match(url, /@\d+\.\d+\.\d+\//);
    assert.ok(tag.includes(`integrity="${asset.integrity}"`));
    assert.ok(tag.includes('crossorigin="anonymous"'));
    assert.match(asset.integrity, /^sha384-[A-Za-z0-9+/]{64}$/);
  }
});

test("the lazy PDF loader sets SRI before insertion and safely handles failed verification", async () => {
  const inserted = [];
  const state = {
    window: {},
    document: {
      createElement: tag => { assert.equal(tag, "script"); return {}; },
      head: { appendChild(script) {
        assert.equal(script.src, manifest.html2pdf.url);
        assert.equal(script.integrity, manifest.html2pdf.integrity);
        assert.equal(script.crossOrigin, "anonymous");
        inserted.push(script);
        queueMicrotask(() => {
          if (inserted.length === 1) script.onerror();
          else { state.window.html2pdf = () => {}; script.onload(); }
        });
      } },
    },
  };
  const start = html.indexOf("const HTML2PDF_SCRIPT_SRC");
  const end = html.indexOf("const createPdfExportElement", start);
  vm.createContext(state);
  vm.runInContext(html.slice(start, end) + "\nglobalThis.loadPdf = loadHtml2pdfLibrary;", state);
  assert.equal(await state.loadPdf(), false);
  assert.equal(await state.loadPdf(), true);
  assert.equal(await state.loadPdf(), true);
  assert.equal(inserted.length, 2);
});
