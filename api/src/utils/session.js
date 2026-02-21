const crypto = require("crypto");
const {
  createSessionEntity,
  getSessionEntity,
  updateSessionEntity,
  deleteSessionEntity,
} = require("./session-store");

const COOKIE_NAME = "session";
const MAX_AGE = parseInt(process.env.SESSION_MAX_AGE, 10) || 86400; // 24h default

function isSecure() {
  return process.env.NODE_ENV === "production";
}

function cookieFlags() {
  return `HttpOnly;${isSecure() ? " Secure;" : ""} SameSite=Lax; Path=/`;
}

function generateSessionId() {
  return crypto.randomBytes(32).toString("base64url"); // 256-bit
}

function getSessionId(request) {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

async function createSession(data) {
  const sessionId = generateSessionId();
  await createSessionEntity(sessionId, data);
  return `${COOKIE_NAME}=${sessionId}; ${cookieFlags()}; Max-Age=${MAX_AGE}`;
}

async function getSession(request) {
  const sessionId = getSessionId(request);
  if (!sessionId) return null;
  try {
    return await getSessionEntity(sessionId);
  } catch {
    return null;
  }
}

async function updateSession(request, updates) {
  const sessionId = getSessionId(request);
  if (!sessionId) return;
  await updateSessionEntity(sessionId, updates);
}

async function destroySession(request) {
  const sessionId = getSessionId(request);
  if (sessionId) {
    await deleteSessionEntity(sessionId);
  }
  return `${COOKIE_NAME}=; ${cookieFlags()}; Max-Age=0`;
}

module.exports = { createSession, getSession, updateSession, destroySession };
