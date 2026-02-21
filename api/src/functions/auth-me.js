const { app } = require("@azure/functions");
const { getSession } = require("../utils/session");
const { checkRateLimit, rateLimitResponse } = require("../utils/rate-limit");

app.http("authMe", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/me",
  handler: async (request) => {
    const rl = checkRateLimit(request, { route: "me", maxRequests: 30 });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

    const session = await getSession(request);
    if (!session || !session.githubToken) {
      return { status: 401, jsonBody: { authenticated: false } };
    }
    return { jsonBody: { authenticated: true, user: session.user } };
  },
});
