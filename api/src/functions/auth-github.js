const { app } = require("@azure/functions");

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";

app.http("authGithub", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/github",
  handler: async () => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return { status: 500, jsonBody: { error: "GITHUB_CLIENT_ID is not configured" } };
    }
    const params = new URLSearchParams({
      client_id: clientId,
      scope: "read:user",
    });
    return {
      status: 302,
      headers: { Location: `${GITHUB_AUTH_URL}?${params}` },
    };
  },
});
