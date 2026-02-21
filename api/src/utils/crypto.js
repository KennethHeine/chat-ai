const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    const nodeEnv = process.env.NODE_ENV;
    const isDev = !nodeEnv || nodeEnv === "development";
    if (!isDev) {
      throw new Error(
        "SESSION_SECRET is not set. It must be defined in non-development environments."
      );
    }
    console.warn(
      "SESSION_SECRET is not set – using insecure default key (development only). " +
        "Do NOT use this configuration in production."
    );
    return crypto.createHash("sha256").update("dev-secret-change-me").digest();
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]);
  return payload.toString("base64url");
}

function decrypt(token) {
  const key = getKey();
  const buf = Buffer.from(token, "base64url");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buf.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = { encrypt, decrypt };
