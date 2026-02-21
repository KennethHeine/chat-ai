const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");

const TABLE_NAME = process.env.SESSION_TABLE_NAME || "sessions";
const PARTITION_KEY = "sess";
const SESSION_TTL_MS = 86400 * 1000; // 24 hours

let _client = null;

function getTableClient() {
  if (_client) return _client;

  const accountName = process.env.AZURE_STORAGE_ACCOUNT;
  if (accountName) {
    const url = `https://${accountName}.table.core.windows.net`;
    _client = new TableClient(url, TABLE_NAME, new DefaultAzureCredential());
  } else {
    const connectionString =
      process.env.AZURE_STORAGE_CONNECTION_STRING ||
      "UseDevelopmentStorage=true";
    _client = TableClient.fromConnectionString(connectionString, TABLE_NAME);
  }
  return _client;
}

async function ensureTable() {
  try {
    await getTableClient().createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = already exists
  }
}

async function createSessionEntity(sessionId, data) {
  await ensureTable();
  const entity = {
    partitionKey: PARTITION_KEY,
    rowKey: sessionId,
    githubToken: data.githubToken,
    userLogin: data.user?.login || "",
    userAvatar: data.user?.avatar || "",
    copilotToken: "",
    copilotBaseUrl: "",
    copilotExpiresAt: 0,
    sessionExpiresAt: Date.now() + SESSION_TTL_MS,
  };
  await getTableClient().createEntity(entity);
}

async function getSessionEntity(sessionId) {
  try {
    const entity = await getTableClient().getEntity(PARTITION_KEY, sessionId);
    if (entity.sessionExpiresAt < Date.now()) {
      await deleteSessionEntity(sessionId);
      return null;
    }
    const session = {
      githubToken: entity.githubToken,
      user: { login: entity.userLogin, avatar: entity.userAvatar },
    };
    if (entity.copilotToken) {
      session.copilotCache = {
        token: entity.copilotToken,
        baseUrl: entity.copilotBaseUrl,
        expiresAt: entity.copilotExpiresAt,
      };
    }
    return session;
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function updateSessionEntity(sessionId, updates) {
  const entity = {
    partitionKey: PARTITION_KEY,
    rowKey: sessionId,
  };
  if (updates.copilotCache) {
    entity.copilotToken = updates.copilotCache.token;
    entity.copilotBaseUrl = updates.copilotCache.baseUrl;
    entity.copilotExpiresAt = updates.copilotCache.expiresAt;
  }
  await getTableClient().updateEntity(entity, "Merge");
}

async function deleteSessionEntity(sessionId) {
  try {
    await getTableClient().deleteEntity(PARTITION_KEY, sessionId);
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
}

module.exports = {
  createSessionEntity,
  getSessionEntity,
  updateSessionEntity,
  deleteSessionEntity,
};
