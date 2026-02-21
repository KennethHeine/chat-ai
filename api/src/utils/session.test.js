jest.mock("./session-store");

const {
  createSessionEntity,
  getSessionEntity,
  updateSessionEntity,
  deleteSessionEntity,
} = require("./session-store");

const {
  createSession,
  getSession,
  updateSession,
  destroySession,
} = require("./session");

function makeRequest(cookie) {
  return {
    headers: {
      get: (key) => (key === "cookie" ? cookie : null),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.NODE_ENV;
});

describe("createSession", () => {
  test("creates a session and returns Set-Cookie header", async () => {
    createSessionEntity.mockResolvedValue();
    const cookie = await createSession({
      githubToken: "gho_abc",
      user: { login: "alice", avatar: "https://example.com/avatar.png" },
    });
    expect(cookie).toMatch(/^session=[A-Za-z0-9_-]+;/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=");
    expect(createSessionEntity).toHaveBeenCalledTimes(1);
    expect(createSessionEntity).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ githubToken: "gho_abc" })
    );
  });

  test("includes Secure flag in production", async () => {
    process.env.NODE_ENV = "production";
    createSessionEntity.mockResolvedValue();
    const cookie = await createSession({ githubToken: "tok" });
    expect(cookie).toContain("Secure");
  });

  test("does not include Secure flag in development", async () => {
    process.env.NODE_ENV = "development";
    createSessionEntity.mockResolvedValue();
    const cookie = await createSession({ githubToken: "tok" });
    expect(cookie).not.toContain("Secure");
  });
});

describe("getSession", () => {
  test("returns session data when valid cookie exists", async () => {
    const sessionData = { githubToken: "gho_abc", user: { login: "alice" } };
    getSessionEntity.mockResolvedValue(sessionData);
    const req = makeRequest("session=abc123; other=val");
    const result = await getSession(req);
    expect(result).toEqual(sessionData);
    expect(getSessionEntity).toHaveBeenCalledWith("abc123");
  });

  test("returns null when no cookie is present", async () => {
    const req = makeRequest(null);
    const result = await getSession(req);
    expect(result).toBeNull();
    expect(getSessionEntity).not.toHaveBeenCalled();
  });

  test("returns null when session cookie is missing", async () => {
    const req = makeRequest("other=val");
    const result = await getSession(req);
    expect(result).toBeNull();
  });

  test("returns null when session-store throws", async () => {
    getSessionEntity.mockRejectedValue(new Error("storage error"));
    const req = makeRequest("session=bad123");
    const result = await getSession(req);
    expect(result).toBeNull();
  });
});

describe("updateSession", () => {
  test("updates session with provided data", async () => {
    updateSessionEntity.mockResolvedValue();
    const req = makeRequest("session=sess123");
    await updateSession(req, { copilotCache: { token: "tok" } });
    expect(updateSessionEntity).toHaveBeenCalledWith("sess123", {
      copilotCache: { token: "tok" },
    });
  });

  test("does nothing when no session cookie", async () => {
    const req = makeRequest(null);
    await updateSession(req, { copilotCache: {} });
    expect(updateSessionEntity).not.toHaveBeenCalled();
  });
});

describe("destroySession", () => {
  test("deletes session and returns expired cookie", async () => {
    deleteSessionEntity.mockResolvedValue();
    const req = makeRequest("session=sess456");
    const cookie = await destroySession(req);
    expect(deleteSessionEntity).toHaveBeenCalledWith("sess456");
    expect(cookie).toContain("session=");
    expect(cookie).toContain("Max-Age=0");
  });

  test("returns expired cookie even when no session exists", async () => {
    const req = makeRequest(null);
    const cookie = await destroySession(req);
    expect(cookie).toContain("Max-Age=0");
    expect(deleteSessionEntity).not.toHaveBeenCalled();
  });
});
