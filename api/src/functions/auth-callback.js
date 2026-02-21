const { app } = require("@azure/functions");
const { createSession } = require("../utils/session");
const { checkRateLimit, rateLimitResponse } = require("../utils/rate-limit");

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

app.http("authCallback", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/github/callback",
  handler: async (request, context) => {
    const rl = checkRateLimit(request, { route: "callback", maxRequests: 10 });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

    const code = request.query.get("code");
    if (!code) {
      return { status: 400, jsonBody: { error: "Missing authorization code" } };
    }

    try {
      const response = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const data = await response.json();
      if (data.error) {
        return { status: 400, jsonBody: { error: data.error_description || data.error } };
      }

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (!userRes.ok) {
        return { status: 502, jsonBody: { error: "Failed to fetch GitHub user info" } };
      }
      const user = await userRes.json();

      const cookie = await createSession({
        githubToken: data.access_token,
        user: { login: user.login, avatar: user.avatar_url },
      });

      return {
        status: 302,
        headers: { Location: "/", "Set-Cookie": cookie },
      };
    } catch (err) {
      context.error("GitHub authentication failed:", err);
      return { status: 502, jsonBody: { error: "GitHub authentication failed" } };
    }
  },
});
