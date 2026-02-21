const { app } = require("@azure/functions");
const { getSession } = require("../utils/session");

app.http("authMe", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/me",
  handler: async (request) => {
    const session = getSession(request);
    if (!session || !session.githubToken) {
      return { status: 401, jsonBody: { authenticated: false } };
    }
    return { jsonBody: { authenticated: true, user: session.user } };
  },
});
