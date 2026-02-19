const express = require("express");
const router = express.Router();

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

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

  req.session.token = data.access_token;

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const user = await userRes.json();
  req.session.user = { login: user.login, avatar: user.avatar_url };

  res.redirect("/");
});

router.get("/me", (req, res) => {
  if (!req.session.token) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, user: req.session.user });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
