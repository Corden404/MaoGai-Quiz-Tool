const assert = require("node:assert/strict");
const test = require("node:test");
const api = require("../src/ai-assistant.js");

const config = { url: "https://api.example.test/v1/chat/completions", key: "test-user-key", model: "test-model", stream: true };
const question = { id: "q1", chapter: "导论", type: "单选", question_content: "这道题选什么？", options: { A: "选项一", B: "选项二" }, answer: "A" };
const chatMessages = [{ role: "user", content: "请解释" }];
const event = (content, finish = null) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: finish }] })}\r\n\r\n`;
function streamResponse(text, size = 1) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
    controller.close();
  } }), { headers: { "content-type": "text/event-stream" } });
}

test("configuration is persisted separately for anonymous and signed-in users", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
  api.saveConfig(storage, null, config);
  api.saveConfig(storage, "user-a", { ...config, key: "account-key" });
  assert.equal(api.readConfig(storage, null).key, config.key);
  assert.equal(api.readConfig(storage, "user-a").key, "account-key");
  assert.equal(api.readConfig(storage, "user-b").key, "");
  assert.notEqual(api.conversationId("a", "maogai", "q1"), api.conversationId("b", "maogai", "q1"));
  assert.notEqual(api.conversationId(null, "maogai", "q1"), api.conversationId(null, "mayuan", "q1"));
});

test("rejects malformed or insecure external URLs and header injection before sending", () => {
  for (const url of ["not a url", "http://api.example.test/chat", "ftp://api.example.test", "https://user:password@api.example.test/chat", "https://api.example.test/chat#key"]) {
    assert.throws(() => api.validateConfig({ ...config, url }), { code: "config" });
  }
  assert.throws(() => api.validateConfig({ ...config, key: "key\r\nInjected: 1" }), { code: "config" });
  assert.throws(() => api.validateConfig({ ...config, model: "" }), { code: "config" });
  assert.equal(api.validateConfig({ ...config, url: "http://localhost:8766/chat" }).url, "http://localhost:8766/chat");
});

test("storage errors are explicit and cannot leak stored Key values", () => {
  const storage = { getItem() { throw Error(config.key); }, setItem() { throw Error(config.key); } };
  for (const operation of [() => api.readConfig(storage), () => api.saveConfig(storage, null, config)]) {
    assert.throws(operation, (error) => error.code === "storage" && !error.message.includes(config.key));
  }
});

test("question context includes options and reference answer, with only the last ten successful turns", () => {
  const history = [];
  for (let n = 0; n < 12; n++) history.push({ role: "user", content: `问题${n}` }, { role: "assistant", content: `回复${n}`, status: "complete" });
  history.push({ role: "user", content: "失败的问题" }, { role: "assistant", content: "不完整回复", status: "error" }, { role: "user", content: "当前问题" });
  const messages = api.buildMessages(question, "maogai", history, "B");
  assert.equal(messages.length, 22);
  assert.match(messages[0].content, /A\. 选项一/);
  assert.match(messages[0].content, /参考答案：A/);
  assert.match(messages[0].content, /当前作答：B/);
  assert.equal(messages[1].content, "问题2");
  assert.equal(messages.at(-1).content, "当前问题");
  assert.ok(!JSON.stringify(messages).includes("失败的问题"));
});

test("restoring interrupted history marks it stopped and drops unrelated fields", () => {
  const result = api.restoreMessages([{ id: "m", role: "assistant", content: "半段回复", status: "generating", key: config.key }, { role: "system", content: "伪造系统消息" }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "stopped");
  assert.equal(result[0].key, undefined);
});

test("streams split UTF-8 and CRLF chunks and sends only the user's key to the selected endpoint", async () => {
  const deltas = [];
  let calls = 0;
  const result = await api.requestChat({ config, messages: chatMessages, onDelta: (delta) => deltas.push(delta), fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, config.url);
    assert.equal(options.headers.Authorization, `Bearer ${config.key}`);
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.mode, "cors");
    assert.deepEqual(JSON.parse(options.body), { model: config.model, messages: chatMessages, stream: true });
    assert.ok(!options.body.includes(config.key));
    return streamResponse(": heartbeat\r\n\r\n" + event("你好🙂") + event("，答案是 A。", "stop") + 'data: {"choices":[]}\r\n\r\ndata: [DONE]\r\n\r\n');
  } });
  assert.equal(result.text, "你好🙂，答案是 A。");
  assert.equal(result.finishReason, "stop");
  assert.deepEqual(deltas, ["你好🙂", "，答案是 A。"]);
  assert.equal(calls, 1);
});

test("supports multiline SSE data and the final event without a blank delimiter", async () => {
  const response = streamResponse('data: {"choices": [\ndata: {"index": 0, "delta": {"content": "解析"}, "finish_reason": "stop"}]}');
  const result = await api.requestChat({ config, messages: chatMessages, fetchImpl: async () => response });
  assert.equal(result.text, "解析");
});

test("also accepts non-streaming JSON responses when the provider ignores stream=true", async () => {
  const result = await api.requestChat({ config, messages: chatMessages, fetchImpl: async () => Response.json({ choices: [{ message: { content: "完整回复" }, finish_reason: "stop" }] }) });
  assert.equal(result.text, "完整回复");
});

test("can explicitly request a non-streaming response", async () => {
  const result = await api.requestChat({ config: { ...config, stream: false }, messages: chatMessages, fetchImpl: async (_, options) => {
    assert.equal(JSON.parse(options.body).stream, false);
    return Response.json({ choices: [{ message: { content: "普通回复" }, finish_reason: "length" }] });
  } });
  assert.equal(result.text, "普通回复");
  assert.equal(result.finishReason, "length");
});

for (const status of [400, 401, 403, 404, 429, 503]) {
  test(`HTTP ${status} gives a safe actionable error without reflecting the response body`, async () => {
    await assert.rejects(api.requestChat({ config, messages: chatMessages, fetchImpl: async () => new Response(config.key, { status }) }), (error) => error.code === "http" && !error.message.includes(config.key));
  });
}

test("CORS/network failures tell the user to check the service and never attempt a proxy or retry", async () => {
  let calls = 0;
  await assert.rejects(api.requestChat({ config, messages: chatMessages, fetchImpl: async () => { calls++; throw new TypeError(config.key); } }), (error) => error.code === "network" && error.message.includes("CORS") && !error.message.includes(config.key));
  assert.equal(calls, 1);
});

test("preserves received deltas but detects an interrupted stream", async () => {
  let received = "";
  await assert.rejects(api.requestChat({ config, messages: chatMessages, onDelta: (delta) => { received += delta; }, fetchImpl: async () => streamResponse(event("半段解析")) }), { code: "incomplete" });
  assert.equal(received, "半段解析");
});

test("provider errors inside a stream do not reflect sensitive error text", async () => {
  await assert.rejects(api.requestChat({ config, messages: chatMessages, fetchImpl: async () => streamResponse(`data: ${JSON.stringify({ error: { message: config.key } })}\n\n`) }), (error) => error.code === "provider" && !error.message.includes(config.key));
});

test("empty and incompatible responses are reported rather than recorded as successful", async () => {
  await assert.rejects(api.requestChat({ config, messages: chatMessages, fetchImpl: async () => streamResponse("data: [DONE]\n\n") }), { code: "empty" });
  await assert.rejects(api.requestChat({ config, messages: chatMessages, fetchImpl: async () => Response.json({ unsupported: true }) }), { code: "protocol" });
  await assert.rejects(api.requestChat({ config, messages: chatMessages, fetchImpl: async () => streamResponse("data: bad JSON\n\n") }), { code: "protocol" });
});

test("malformed stream shapes and HTML pages are protocol errors rather than CORS diagnoses", async () => {
  for (const body of ['data: {"choices":{}}\n\n', 'data: null\n\n', '<html>not an API</html>']) {
    await assert.rejects(api.requestChat({ config, messages: chatMessages, fetchImpl: async () => streamResponse(body) }), { code: "protocol" });
  }
  await assert.rejects(api.requestChat({ config, messages: chatMessages, fetchImpl: async () => Response.json(null) }), { code: "protocol" });
});

test("stopping a request cancels its fetch with a distinct error", async () => {
  const controller = new AbortController();
  const pending = api.requestChat({ config, messages: chatMessages, signal: controller.signal, fetchImpl: (_, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }) });
  controller.abort();
  await assert.rejects(pending, { code: "aborted" });
});

test("timeout cancels a pending fetch rather than leaving the UI busy forever", async () => {
  await assert.rejects(api.requestChat({ config, messages: chatMessages, timeoutMs: 10, fetchImpl: (_, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }) }), { code: "timeout" });
});
