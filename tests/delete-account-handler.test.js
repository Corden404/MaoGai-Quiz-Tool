const assert = require("node:assert/strict");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const handlerModuleUrl = pathToFileURL(
  path.join(__dirname, "../supabase/functions/delete-account/handler.mjs"),
).href;

async function loadHandler() {
  return import(handlerModuleUrl);
}

function makeRequest({
  method = "POST",
  authorization = "Bearer valid-token",
  body = { password: "correct horse battery staple" },
} = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== null) headers.set("authorization", authorization);

  return new Request("https://example.test/functions/v1/delete-account", {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function createDependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    dependencies: {
      getUserByToken: async (token) => {
        calls.push(["getUserByToken", token]);
        return { id: "user-a", email: "user@example.com" };
      },
      verifyPassword: async ({ email, password }) => {
        calls.push(["verifyPassword", email, password]);
        return { id: "user-a", email };
      },
      revokeSessions: async ({ accessToken, userId }) => {
        calls.push(["revokeSessions", accessToken, userId]);
      },
      deleteUser: async (userId) => {
        calls.push(["deleteUser", userId]);
      },
      ...overrides,
    },
  };
}

test("answers CORS preflight without touching auth", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies();
  const handler = createDeleteAccountHandler(dependencies);

  const response = await handler(makeRequest({ method: "OPTIONS" }));

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.deepEqual(calls, []);
});

test("rejects methods other than POST", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies();
  const handler = createDeleteAccountHandler(dependencies);

  const response = await handler(makeRequest({ method: "GET" }));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST, OPTIONS");
  assert.deepEqual(calls, []);
});

test("requires a bearer token", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies();
  const handler = createDeleteAccountHandler(dependencies);

  const missing = await handler(makeRequest({ authorization: null }));
  const malformed = await handler(makeRequest({ authorization: "Basic abc" }));

  assert.equal(missing.status, 401);
  assert.equal(malformed.status, 401);
  assert.deepEqual(calls, []);
});

test("rejects malformed, missing, empty, and oversized passwords", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies();
  const handler = createDeleteAccountHandler(dependencies);

  const malformed = new Request("https://example.test/functions/v1/delete-account", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    },
    body: "{",
  });

  for (const request of [
    malformed,
    makeRequest({ body: {} }),
    makeRequest({ body: { password: "" } }),
    makeRequest({ body: { password: "馃攽".repeat(1025) } }),
  ]) {
    const response = await handler(request);
    assert.equal(response.status, 400);
  }

  assert.deepEqual(calls, []);
});

test("rejects invalid sessions without checking the password", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies({
    getUserByToken: async (token) => {
      calls.push(["getUserByToken", token]);
      return null;
    },
  });
  const handler = createDeleteAccountHandler(dependencies);

  const response = await handler(makeRequest());

  assert.equal(response.status, 401);
  assert.deepEqual(calls, [["getUserByToken", "valid-token"]]);
});

test("rejects a wrong password", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies({
    verifyPassword: async ({ email, password }) => {
      calls.push(["verifyPassword", email, password]);
      return null;
    },
  });
  const handler = createDeleteAccountHandler(dependencies);

  const response = await handler(makeRequest());

  assert.equal(response.status, 401);
  assert.equal(calls.some(([name]) => name === "deleteUser"), false);
});

test("rejects password verification for a different user", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies({
    verifyPassword: async ({ email, password }) => {
      calls.push(["verifyPassword", email, password]);
      return { id: "user-b", email };
    },
  });
  const handler = createDeleteAccountHandler(dependencies);

  const response = await handler(makeRequest());

  assert.equal(response.status, 401);
  assert.equal(calls.some(([name]) => name === "deleteUser"), false);
});

test("revokes global sessions before deleting the verified caller", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies();
  const handler = createDeleteAccountHandler(dependencies);

  const response = await handler(makeRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(calls, [
    ["getUserByToken", "valid-token"],
    ["verifyPassword", "user@example.com", "correct horse battery staple"],
    ["revokeSessions", "valid-token", "user-a"],
    ["deleteUser", "user-a"],
  ]);
});

test("returns an internal error and does not delete when session revocation fails", async () => {
  const { createDeleteAccountHandler } = await loadHandler();
  const { calls, dependencies } = createDependencies({
    revokeSessions: async ({ accessToken, userId }) => {
      calls.push(["revokeSessions", accessToken, userId]);
      throw new Error("auth unavailable");
    },
  });
  const handler = createDeleteAccountHandler(dependencies);

  const response = await handler(makeRequest());

  assert.equal(response.status, 500);
  assert.equal(calls.some(([name]) => name === "deleteUser"), false);
});
