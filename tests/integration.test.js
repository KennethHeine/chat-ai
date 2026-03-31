/**
 * Integration tests — require TEST_GITHUB_PAT environment variable.
 * These test the full auth → copilot token → models → chat flow.
 * Skipped automatically when no PAT is available.
 */

const express = require("express");
const session = require("express-session");

const PAT = process.env.TEST_GITHUB_PAT;

function startServer() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "integration-test-secret",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      })
    );
    app.use("/auth", require("../server/auth"));
    const server = app.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
}

async function request(port, path, options = {}) {
  const url = `http://127.0.0.1:${port}${path}`;
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, body };
}

(PAT ? describe : describe.skip)("Integration: full auth → chat flow", () => {
  let server;
  let port;
  let sessionCookie;

  beforeAll(async () => {
    ({ server, port } = await startServer());
  });

  afterAll(async () => {
    await stopServer(server);
  });

  test("POST /auth/dev-login with PAT returns 200 and authenticated:true", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pat: PAT }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.authenticated).toBe(true);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    // Extract the session cookie value (first cookie in the header)
    sessionCookie = setCookie.split(";")[0];
  });

  test("GET /auth/me with session cookie returns 200 and authenticated:true", async () => {
    const { status, body } = await request(port, "/auth/me", {
      headers: { Cookie: sessionCookie },
    });
    expect(status).toBe(200);
    expect(body.authenticated).toBe(true);
  });

  test("GET /auth/models with session cookie returns 200 with models array", async () => {
    const { status, body } = await request(port, "/auth/models", {
      headers: { Cookie: sessionCookie },
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.models.length).toBeGreaterThan(0);
    for (const model of body.models) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("name");
    }
  });

  test("GET /auth/copilot-token with session cookie returns 200 with token and baseUrl", async () => {
    const { status, body } = await request(port, "/auth/copilot-token", {
      headers: { Cookie: sessionCookie },
    });
    expect(status).toBe(200);
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("baseUrl");
  });

  test("(optional) Copilot chat completion returns choices", async () => {
    // Get a fresh copilot token
    const tokenRes = await request(port, "/auth/copilot-token", {
      headers: { Cookie: sessionCookie },
    });
    if (tokenRes.status !== 200) {
      console.warn("Skipping chat test — could not get Copilot token");
      return;
    }
    const { token, baseUrl } = tokenRes.body;

    let chatRes;
    try {
      chatRes = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Say hello in one word." }],
          max_tokens: 10,
          stream: false,
        }),
      });
    } catch (err) {
      console.warn("Skipping chat test — network error:", err.message);
      return;
    }

    if (!chatRes.ok) {
      console.warn("Skipping chat test — Copilot API returned", chatRes.status);
      return;
    }

    const data = await chatRes.json();
    expect(data).toHaveProperty("choices");
    expect(Array.isArray(data.choices)).toBe(true);
  });
});
