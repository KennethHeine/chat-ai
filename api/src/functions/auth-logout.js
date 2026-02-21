const { app } = require("@azure/functions");
const { clearSession } = require("../utils/session");

app.http("authLogout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/logout",
  handler: async (request) => {
    const origin = request.headers.get("origin");
    if (origin) {
      const host = request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const allowed = `${proto}://${host}`;
      if (origin !== allowed) {
        return { status: 403, jsonBody: { error: "Forbidden" } };
      }
    }

    return {
      jsonBody: { ok: true },
      headers: { "Set-Cookie": clearSession() },
    };
  },
});
