const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("index.html", "utf8");

const publicNotesTemplateStart = html.indexOf('v-for="(pn, index) in publicNotes"');
const publicNotesTemplateEnd = html.indexOf("<!-- 笔记相关", publicNotesTemplateStart);
const publicNotesTemplate = html.slice(
  publicNotesTemplateStart,
  publicNotesTemplateEnd > publicNotesTemplateStart
    ? publicNotesTemplateEnd
    : publicNotesTemplateStart + 5000,
);

test("loads the user data security helper before the application", () => {
  const helper = html.indexOf('<script src="src/user-data-security.js"></script>');
  const app = html.indexOf("document.addEventListener('DOMContentLoaded'");

  assert.ok(helper >= 0, "security helper should be loaded");
  assert.ok(helper < app, "security helper should load before application setup");
});

test("public notes use RPCs and never read the underlying table directly", () => {
  assert.doesNotMatch(html, /\.from\(['"]public_notes['"]\)/);
  assert.match(html, /\.rpc\(['"]get_public_notes['"]/);
  assert.match(html, /\.rpc\(['"]upsert_public_note['"]/);
  assert.match(html, /\.rpc\(['"]toggle_public_note_like['"]/);
});

test("public note UI renders anonymous display names without email or UUID fields", () => {
  assert.ok(publicNotesTemplateStart >= 0, "public notes template should exist");
  assert.match(publicNotesTemplate, /pn\.display_name/);
  assert.doesNotMatch(publicNotesTemplate, /pn\.user_email|pn\.user_id/);
});

test("note editor exposes the 2000-character limit and validates before saving", () => {
  assert.match(html, /MAX_NOTE_LENGTH/);
  assert.match(html, /noteCharacterCount/);
  assert.match(html, /validateNoteContent\(noteContent\.value/);
  assert.match(html, /2000/);
});

test("progress uses account-scoped helpers instead of the shared storage key", () => {
  assert.match(html, /migrateLegacyProgress\(localStorage\)/);
  assert.match(html, /readProgress\(localStorage,/);
  assert.match(html, /writeProgress\(localStorage,/);
  assert.match(html, /canSyncProgress\(/);
  assert.doesNotMatch(html, /const LOCAL_STORAGE_KEY/);
  assert.doesNotMatch(html, /localStorage\.setItem\(LOCAL_STORAGE_KEY/);
  assert.doesNotMatch(html, /localStorage\.getItem\(LOCAL_STORAGE_KEY/);
});

test("account deletion requires a password and invokes the protected Edge Function", () => {
  assert.match(html, /v-model="deletePassword"/);
  assert.match(html, /type="password"/);
  assert.match(html, /\.functions\.invoke\(['"]delete-account['"]/);
  assert.match(html, /body:\s*\{\s*password:\s*deletePassword\.value\s*\}/);
  assert.doesNotMatch(html, /\.rpc\(['"]delete_user['"]/);
});
