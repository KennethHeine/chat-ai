const express = require("express");
const router = express.Router();

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
const DEFAULT_COPILOT_BASE = "https://api.individual.githubcopilot.com";
const TOKEN_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

// --------------- GitHub OAuth ---------------

router.get("/github", (_req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: "GITHUB_CLIENT_ID is not configured" });
  }
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read:user",
  });
  res.redirect(`${GITHUB_AUTH_URL}?${params}`);
});

router.get("/github/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
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
      return res.status(400).json({ error: data.error_description || data.error });
    }

    req.session.githubToken = data.access_token;

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!userRes.ok) {
      return res.status(502).json({ error: "Failed to fetch GitHub user info" });
    }
    const user = await userRes.json();
    req.session.user = { login: user.login, avatar: user.avatar_url };

    res.redirect("/");
  } catch (err) {
    res.status(502).json({ error: "GitHub authentication failed" });
  }
});

// --------------- Session check ---------------

router.get("/me", (req, res) => {
  if (!req.session.githubToken) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, user: req.session.user });
});

// --------------- Dev login (non-production only) ---------------

router.post("/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  const pat = req.body?.pat;
  if (!pat || typeof pat !== "string") {
    return res.status(400).json({ error: "Missing or invalid PAT" });
  }

  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/json",
      },
    });
    if (!userRes.ok) {
      return res.status(401).json({ error: "Invalid GitHub token" });
    }
    const user = await userRes.json();
    req.session.githubToken = pat;
    req.session.user = { login: user.login, avatar: user.avatar_url };
    res.json({ authenticated: true, user: req.session.user });
  } catch {
    res.status(502).json({ error: "GitHub API request failed" });
  }
});

// --------------- Models ---------------

const COPILOT_MODELS = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4.1", name: "GPT-4.1" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
  { id: "o3-mini", name: "o3-mini" },
  { id: "o1", name: "o1" },
  { id: "o1-mini", name: "o1-mini" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
];

router.get("/models", (req, res) => {
  if (!req.session.githubToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ models: COPILOT_MODELS });
});

// --------------- Copilot token exchange ---------------

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

router.get("/copilot-token", async (req, res) => {
  if (!req.session.githubToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (isCacheUsable(req.session.copilotCache)) {
    return res.json({
      token: req.session.copilotCache.token,
      baseUrl: req.session.copilotCache.baseUrl,
    });
  }

  try {
    const response = await fetch(COPILOT_TOKEN_URL, {
      headers: {
        Authorization: `Bearer ${req.session.githubToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn("Copilot token exchange returned HTTP %d", response.status);
      return res.status(response.status).json({ error: "Copilot token exchange failed" });
    }

    const data = await response.json();
    const baseUrl = parseBaseUrl(data.token);
    let expiresAt = data.expires_at;
    if (expiresAt < 10_000_000_000) expiresAt *= 1000; // convert s → ms

    req.session.copilotCache = {
      token: data.token,
      baseUrl,
      expiresAt,
      updatedAt: Date.now(),
    };

    res.json({ token: data.token, baseUrl });
  } catch (err) {
    res.status(502).json({ error: "Copilot token exchange failed" });
  }
});

// --------------- Logout ---------------

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
