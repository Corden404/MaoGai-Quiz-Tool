const CORS_HEADERS = Object.freeze({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
});

function jsonResponse(status, payload, additionalHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...additionalHeaders,
    },
  });
}

function unauthorized() {
  return jsonResponse(401, { error: "invalid_credentials" });
}

function readBearerToken(request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer[ \t]+([^ \t]+)$/i);
  return match?.[1] ?? null;
}

export function createDeleteAccountHandler({
  getUserByToken,
  verifyPassword,
  revokeSessions,
  deleteUser,
}) {
  return async function deleteAccountHandler(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        405,
        { error: "method_not_allowed" },
        { allow: "POST, OPTIONS" },
      );
    }

    const accessToken = readBearerToken(request);
    if (!accessToken) return unauthorized();

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "invalid_request" });
    }

    const password = body?.password;
    if (
      typeof password !== "string" ||
      password.length === 0 ||
      Array.from(password).length > 1024
    ) {
      return jsonResponse(400, { error: "invalid_request" });
    }

    try {
      const caller = await getUserByToken(accessToken);
      if (!caller?.id || !caller.email) return unauthorized();

      const verifiedUser = await verifyPassword({
        email: caller.email,
        password,
      });
      if (!verifiedUser?.id || verifiedUser.id !== caller.id) {
        return unauthorized();
      }

      await revokeSessions({ accessToken, userId: caller.id });
      await deleteUser(caller.id);

      return jsonResponse(200, { ok: true });
    } catch {
      return jsonResponse(500, { error: "internal_error" });
    }
  };
}
