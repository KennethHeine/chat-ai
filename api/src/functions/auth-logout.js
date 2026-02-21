const { app } = require("@azure/functions");
const { clearSession } = require("../utils/session");

app.http("authLogout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/logout",
  handler: async () => {
    return {
      jsonBody: { ok: true },
      headers: { "Set-Cookie": clearSession() },
    };
  },
});
