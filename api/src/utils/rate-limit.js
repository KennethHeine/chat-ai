const WINDOW_MS = 60 * 1000; // 1-minute sliding window

const stores = new Map();
let lastCleanup = Date.now();

function getStore(route) {
  if (!stores.has(route)) {
    stores.set(route, new Map());
  }
  return stores.get(route);
}

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < WINDOW_MS) return;
  lastCleanup = now;
  for (const store of stores.values()) {
    for (const [key, record] of store) {
      if (now - record.windowStart >= WINDOW_MS) {
        store.delete(key);
      }
    }
  }
}

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("client-ip") || "unknown";
}

/**
 * Check whether a request is within the rate limit.
 * @param {import("@azure/functions").HttpRequest} request
 * @param {{ route: string, maxRequests?: number }} opts
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
function checkRateLimit(request, { route, maxRequests = 60 }) {
  cleanup();

  const store = getStore(route);
  const ip = getClientIp(request);
  const now = Date.now();

  let record = store.get(ip);
  if (!record || now - record.windowStart >= WINDOW_MS) {
    record = { windowStart: now, count: 0 };
    store.set(ip, record);
  }

  record.count++;

  if (record.count > maxRequests) {
    const retryAfter = Math.ceil(
      (record.windowStart + WINDOW_MS - now) / 1000
    );
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/**
 * Return a 429 response when the rate limit is exceeded.
 */
function rateLimitResponse(retryAfter) {
  return {
    status: 429,
    headers: { "Retry-After": String(retryAfter) },
    jsonBody: { error: "Too many requests. Please try again later." },
  };
}

module.exports = { checkRateLimit, rateLimitResponse };
