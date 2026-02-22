const { checkRateLimit, rateLimitResponse } = require("./rate-limit");

function makeRequest(ip, headers = {}) {
  const h = new Map(Object.entries(headers));
  if (ip && !h.has("x-forwarded-for") && !h.has("client-ip")) {
    h.set("x-forwarded-for", ip);
  }
  return { headers: { get: (key) => h.get(key) || null } };
}

// Each test uses a unique route name so the in-memory store doesn't leak state.

describe("checkRateLimit", () => {
  test("allows requests under the limit", () => {
    const req = makeRequest("10.0.0.1");
    const result = checkRateLimit(req, { route: "test-allow", maxRequests: 5 });
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  test("blocks requests when limit is reached", () => {
    const req = makeRequest("10.0.0.2");
    for (let i = 0; i < 3; i++) {
      checkRateLimit(req, { route: "test-block", maxRequests: 3 });
    }
    const result = checkRateLimit(req, { route: "test-block", maxRequests: 3 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test("uses stricter limit for unknown IP", () => {
    const req = makeRequest(null, {});
    // unknown IP gets min(maxRequests, 5)
    for (let i = 0; i < 5; i++) {
      checkRateLimit(req, { route: "test-unknown", maxRequests: 60 });
    }
    const result = checkRateLimit(req, { route: "test-unknown", maxRequests: 60 });
    expect(result.allowed).toBe(false);
  });

  test("tracks routes independently", () => {
    const req = makeRequest("10.0.0.3");
    for (let i = 0; i < 2; i++) {
      checkRateLimit(req, { route: "route-a", maxRequests: 2 });
    }
    const blockedA = checkRateLimit(req, { route: "route-a", maxRequests: 2 });
    expect(blockedA.allowed).toBe(false);

    const allowedB = checkRateLimit(req, { route: "route-b", maxRequests: 2 });
    expect(allowedB.allowed).toBe(true);
  });

  test("tracks IPs independently", () => {
    const req1 = makeRequest("10.0.0.4");
    const req2 = makeRequest("10.0.0.5");
    for (let i = 0; i < 2; i++) {
      checkRateLimit(req1, { route: "test-ip", maxRequests: 2 });
    }
    const blocked = checkRateLimit(req1, { route: "test-ip", maxRequests: 2 });
    expect(blocked.allowed).toBe(false);

    const allowed = checkRateLimit(req2, { route: "test-ip", maxRequests: 2 });
    expect(allowed.allowed).toBe(true);
  });

  test("extracts IP from x-forwarded-for (first entry)", () => {
    const req = makeRequest(null, { "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    for (let i = 0; i < 2; i++) {
      checkRateLimit(req, { route: "test-xff", maxRequests: 2 });
    }
    const result = checkRateLimit(req, { route: "test-xff", maxRequests: 2 });
    expect(result.allowed).toBe(false);

    // Different first IP should be tracked separately
    const req2 = makeRequest(null, { "x-forwarded-for": "9.9.9.9, 5.6.7.8" });
    const result2 = checkRateLimit(req2, { route: "test-xff", maxRequests: 2 });
    expect(result2.allowed).toBe(true);
  });

  test("falls back to client-ip header", () => {
    const req = makeRequest(null, { "client-ip": "192.168.1.1" });
    const result = checkRateLimit(req, { route: "test-clientip", maxRequests: 5 });
    expect(result.allowed).toBe(true);
  });

  test("uses default maxRequests of 60", () => {
    const req = makeRequest("10.0.0.6");
    const result = checkRateLimit(req, { route: "test-default" });
    expect(result.allowed).toBe(true);
  });
});

describe("rateLimitResponse", () => {
  test("returns 429 with Retry-After header", () => {
    const response = rateLimitResponse(30);
    expect(response.status).toBe(429);
    expect(response.headers["Retry-After"]).toBe("30");
    expect(response.jsonBody.error).toContain("Too many requests");
  });
});
