const express = require("express");
const session = require("express-session");

let app, server;

function startServer() {
  return new Promise((resolve) => {
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-secret",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }, // tests run over HTTP on localhost
      })
    );
    app.use("/auth", require("./auth"));
    server = app.listen(0, () => resolve(server.address().port));
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
}

function request(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${port}${path}`;
    fetch(url, options).then(async (res) => {
      const body = await res.json().catch(() => null);
      resolve({ status: res.status, headers: res.headers, body });
    }).catch(reject);
  });
}

let port;
let originalEnv;

beforeAll(async () => {
  originalEnv = { ...process.env };
  port = await startServer();
});

afterAll(async () => {
  await stopServer();
  process.env = originalEnv;
});

describe("GET /auth/github", () => {
  test("redirects to GitHub OAuth when CLIENT_ID is set", async () => {
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    const res = await fetch(`http://127.0.0.1:${port}/auth/github`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("github.com/login/oauth/authorize");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain("scope=read%3Auser");
  });

  test("returns 500 when CLIENT_ID is not set", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    const { status, body } = await request(port, "/auth/github");
    expect(status).toBe(500);
    expect(body.error).toContain("GITHUB_CLIENT_ID");
  });
});

describe("GET /auth/github/callback", () => {
  test("returns 400 when code is missing", async () => {
    const { status, body } = await request(port, "/auth/github/callback");
    expect(status).toBe(400);
    expect(body.error).toContain("Missing authorization code");
  });
});

describe("GET /auth/me", () => {
  test("returns 401 when not authenticated", async () => {
    const { status, body } = await request(port, "/auth/me");
    expect(status).toBe(401);
    expect(body.authenticated).toBe(false);
  });
});

describe("POST /auth/logout", () => {
  test("returns ok:true", async () => {
    const { status, body } = await request(port, "/auth/logout", {
      method: "POST",
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

describe("GET /auth/copilot-token", () => {
  test("returns 401 when not authenticated", async () => {
    const { status, body } = await request(port, "/auth/copilot-token");
    expect(status).toBe(401);
    expect(body.error).toContain("Not authenticated");
  });
});

describe("POST /auth/dev-login", () => {
  test("returns 400 when PAT is missing", async () => {
    const { status, body } = await request(port, "/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/Missing|invalid/i);
  });

  test("returns 404 when NODE_ENV is production", async () => {
    process.env.NODE_ENV = "production";
    try {
      const { status } = await request(port, "/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: "ghp_test" }),
      });
      expect(status).toBe(404);
    } finally {
      if (originalEnv.NODE_ENV === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalEnv.NODE_ENV;
      }
    }
  });
});

describe("GET /auth/models", () => {
  test("returns 401 when not authenticated", async () => {
    const { status, body } = await request(port, "/auth/models");
    expect(status).toBe(401);
    expect(body.error).toContain("Not authenticated");
  });
});
