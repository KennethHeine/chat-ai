const { app } = require("@azure/functions");
const { getSession, setSession } = require("../utils/session");

const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
const DEFAULT_COPILOT_BASE = "https://api.individual.githubcopilot.com";
const TOKEN_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

function parseBaseUrl(tokenString) {
  const match = tokenString.match(/proxy-ep=([^;]+)/);
  if (!match) return DEFAULT_COPILOT_BASE;
  const proxyHost = match[1];
  const apiHost = proxyHost.replace(/^proxy\./, "api.");
  return `https://${apiHost}`;
}

function isCacheUsable(cache) {
  return cache && cache.expiresAt - Date.now() > TOKEN_MARGIN_MS;
}

app.http("authCopilotToken", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/copilot-token",
  handler: async (request, context) => {
    const session = getSession(request);
    if (!session || !session.githubToken) {
      return { status: 401, jsonBody: { error: "Not authenticated" } };
    }

    if (isCacheUsable(session.copilotCache)) {
      return {
        jsonBody: {
          token: session.copilotCache.token,
          baseUrl: session.copilotCache.baseUrl,
        },
      };
    }

    try {
      const response = await fetch(COPILOT_TOKEN_URL, {
        headers: {
          Authorization: `Bearer ${session.githubToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        return { status: response.status, jsonBody: { error: `Token exchange failed: ${text}` } };
      }

      const data = await response.json();
      const baseUrl = parseBaseUrl(data.token);
      let expiresAt = data.expires_at;
      if (expiresAt < 10_000_000_000) expiresAt *= 1000; // seconds → ms

      session.copilotCache = { token: data.token, baseUrl, expiresAt };
      const cookie = setSession(session);

      return {
        jsonBody: { token: data.token, baseUrl },
        headers: { "Set-Cookie": cookie },
      };
    } catch (err) {
      context.error("Copilot token exchange failed:", err);
      return { status: 502, jsonBody: { error: "Copilot token exchange failed" } };
    }
  },
});
