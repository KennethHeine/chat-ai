const express = require("express");
const router = express.Router();

const COPILOT_CHAT_URL =
  "https://api.githubcopilot.com/chat/completions";

router.post("/chat", async (req, res) => {
  const token = req.session.token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const payload = {
    model: "gpt-4o",
    messages,
    stream: false,
  };

  const response = await fetch(COPILOT_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    return res
      .status(response.status)
      .json({ error: `Copilot API error: ${text}` });
  }

  const data = await response.json();
  const reply =
    data.choices?.[0]?.message?.content ?? "No response from model.";
  res.json({ reply });
});

module.exports = router;
