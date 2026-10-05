const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const security = require("../src/user-data-security.js");
const html = fs.readFileSync("index.html", "utf8");

function editor() {
  const ref = value => ({ value });
  const calls = [];
  const rows = new Map();
  const state = {
    ...security, ref, computed: getter => ({ get value() { return getter(); } }), watch() {},
    authTransitionVersion: 0, currentUser: ref({ id: "a" }), currentQuestion: ref({ id: "q1" }),
    isAuthTransitioning: ref(false), showNote: ref(true), noteContent: ref("first public note"),
    shareToPublic: ref(false), saveBtnText: ref(""), publicNotes: ref([]),
    userProgress: ref(security.createEmptyProgress()), saveProgress() {}, showToast() {},
    setTimeout() {}, console: { error() {} },
  };
  state.supabaseClient = { async rpc(name, args) {
    calls.push({ name, args });
    if (name === "get_public_notes") return { data: rows.has(args.p_question_id) ? [{ is_mine: true }] : [], error: null };
    assert.equal(name, "set_public_note_sharing");
    assert.equal(args.p_expected_user_id, state.currentUser.value.id);
    if (args.p_is_public) rows.set(args.p_question_id, args.p_content);
    else rows.delete(args.p_question_id);
    return { data: args.p_is_public, error: null };
  } };
  const start = html.indexOf("const noteSharingState =");
  const end = html.indexOf("const showAllNotes", start);
  vm.createContext(state);
  vm.runInContext(html.slice(start, end) + `\nglobalThis.api = {
    loadNoteSharingState, saveNote, sharingStateReady, isSavingNote, noteSharingState
  };`, state);
  return { state, rows, calls };
}

test("publish then uncheck/save sends a revocation and preserves private edits", async () => {
  const { state: s, rows, calls } = editor();
  await s.api.loadNoteSharingState();
  s.shareToPublic.value = true;
  await s.api.saveNote();
  assert.equal(rows.get("q1"), "first public note");
  s.shareToPublic.value = false;
  s.noteContent.value = "new private note";
  await s.api.saveNote();
  assert.equal(rows.has("q1"), false);
  assert.equal(s.userProgress.value.notes.q1, "new private note");
  const writes = calls.filter(call => call.name === "set_public_note_sharing");
  assert.deepEqual(writes.map(call => call.args.p_is_public), [true, false]);
  assert.equal(s.saveBtnText.value, "✅ 已保存");
});

test("an existing public note is loaded before saving is allowed", async () => {
  const { state: s, rows, calls } = editor();
  rows.set("q1", "existing public note");
  await s.api.saveNote();
  assert.equal(calls.length, 0);
  await s.api.loadNoteSharingState();
  assert.equal(s.api.sharingStateReady.value, true);
  assert.equal(s.shareToPublic.value, true);
});

test("a failed revocation retains the public state and does not claim complete success", async () => {
  const { state: s, rows } = editor();
  rows.set("q1", "existing public note");
  await s.api.loadNoteSharingState();
  const original = s.supabaseClient.rpc;
  s.supabaseClient.rpc = (name, args) => name === "set_public_note_sharing"
    ? Promise.resolve({ error: new Error("offline") }) : original(name, args);
  s.shareToPublic.value = false;
  s.noteContent.value = "private edit";
  await s.api.saveNote();
  assert.equal(rows.get("q1"), "existing public note");
  assert.equal(s.shareToPublic.value, true);
  assert.equal(s.saveBtnText.value, "私人笔记已保存");
  assert.equal(s.api.isSavingNote.value, false);
  assert.equal(s.userProgress.value.notes.q1, "private edit");
});

test("late sharing-state responses cannot affect another account", async () => {
  const { state: s } = editor();
  let resolve;
  s.supabaseClient.rpc = () => new Promise(done => { resolve = done; });
  const load = s.api.loadNoteSharingState();
  s.currentUser.value = { id: "b" };
  s.authTransitionVersion++;
  resolve({ data: [{ is_mine: true }], error: null });
  await load;
  assert.equal(s.shareToPublic.value, false);
  assert.equal(s.api.sharingStateReady.value, false);
});

test("anonymous private notes remain local and never call publication APIs", async () => {
  const { state: s, calls } = editor();
  s.currentUser.value = null;
  await s.api.saveNote();
  assert.equal(calls.length, 0);
  assert.equal(s.userProgress.value.notes.q1, "first public note");
});
