const { app } = require("@azure/functions");
const { destroySession } = require("../utils/session");
const { checkRateLimit, rateLimitResponse } = require("../utils/rate-limit");

app.http("authLogout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/logout",
  handler: async (request) => {
    const rl = checkRateLimit(request, { route: "logout", maxRequests: 10 });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

    const origin = request.headers.get("origin");
    if (origin) {
      const host = request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const allowed = `${proto}://${host}`;
      if (origin !== allowed) {
        return { status: 403, jsonBody: { error: "Forbidden" } };
      }
    }

    const cookie = await destroySession(request);
    return {
      jsonBody: { ok: true },
      headers: { "Set-Cookie": cookie },
    };
  },
});
