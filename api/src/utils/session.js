const { encrypt, decrypt } = require("./crypto");

const COOKIE_NAME = "session";
const MAX_AGE = 86400; // 24 hours in seconds

function setSession(data) {
  const encrypted = encrypt(JSON.stringify(data));
  return `${COOKIE_NAME}=${encrypted}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

function getSession(request) {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decrypt(match[1]));
  } catch {
    return null;
  }
}

function clearSession() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

module.exports = { setSession, getSession, clearSession };
