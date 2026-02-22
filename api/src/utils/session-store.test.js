const mockTableClient = {
  createTable: jest.fn(),
  createEntity: jest.fn(),
  getEntity: jest.fn(),
  updateEntity: jest.fn(),
  deleteEntity: jest.fn(),
};

jest.mock("@azure/data-tables", () => {
  const TableClient = jest.fn(() => mockTableClient);
  TableClient.fromConnectionString = jest.fn(() => mockTableClient);
  return { TableClient };
});

jest.mock("@azure/identity", () => ({
  DefaultAzureCredential: jest.fn(),
}));

const {
  createSessionEntity,
  getSessionEntity,
  updateSessionEntity,
  deleteSessionEntity,
} = require("./session-store");

beforeEach(() => {
  jest.clearAllMocks();
  mockTableClient.createTable.mockResolvedValue();
});

describe("createSessionEntity", () => {
  test("creates table and entity", async () => {
    mockTableClient.createEntity.mockResolvedValue();
    await createSessionEntity("sess-id-1", {
      githubToken: "gho_token",
      user: { login: "alice", avatar: "https://example.com/avatar.png" },
    });
    expect(mockTableClient.createTable).toHaveBeenCalled();
    expect(mockTableClient.createEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        partitionKey: "sess",
        rowKey: "sess-id-1",
        githubToken: "gho_token",
        userLogin: "alice",
        userAvatar: "https://example.com/avatar.png",
      })
    );
  });

  test("handles missing user fields gracefully", async () => {
    mockTableClient.createEntity.mockResolvedValue();
    await createSessionEntity("sess-id-2", { githubToken: "tok" });
    expect(mockTableClient.createEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        userLogin: "",
        userAvatar: "",
      })
    );
  });

  test("tolerates table already existing (409)", async () => {
    mockTableClient.createTable.mockRejectedValue({ statusCode: 409 });
    mockTableClient.createEntity.mockResolvedValue();
    await expect(
      createSessionEntity("sess-id-3", { githubToken: "tok" })
    ).resolves.not.toThrow();
  });

  test("rethrows non-409 table creation errors", async () => {
    mockTableClient.createTable.mockRejectedValue({ statusCode: 500, message: "Server error" });
    await expect(
      createSessionEntity("sess-id-4", { githubToken: "tok" })
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("getSessionEntity", () => {
  test("returns session data for valid session", async () => {
    mockTableClient.getEntity.mockResolvedValue({
      githubToken: "gho_tok",
      userLogin: "bob",
      userAvatar: "https://avatar.url",
      copilotToken: "",
      sessionExpiresAt: Date.now() + 100000,
    });
    const result = await getSessionEntity("sess-valid");
    expect(result).toEqual({
      githubToken: "gho_tok",
      user: { login: "bob", avatar: "https://avatar.url" },
    });
  });

  test("returns copilotCache when present", async () => {
    mockTableClient.getEntity.mockResolvedValue({
      githubToken: "gho_tok",
      userLogin: "bob",
      userAvatar: "https://avatar.url",
      copilotToken: "cp_tok",
      copilotBaseUrl: "https://api.copilot.com",
      copilotExpiresAt: 9999999999999,
      sessionExpiresAt: Date.now() + 100000,
    });
    const result = await getSessionEntity("sess-copilot");
    expect(result.copilotCache).toEqual({
      token: "cp_tok",
      baseUrl: "https://api.copilot.com",
      expiresAt: 9999999999999,
    });
  });

  test("returns null and deletes expired session", async () => {
    mockTableClient.getEntity.mockResolvedValue({
      githubToken: "gho_tok",
      userLogin: "bob",
      userAvatar: "",
      sessionExpiresAt: Date.now() - 1000, // expired
    });
    mockTableClient.deleteEntity.mockResolvedValue();
    const result = await getSessionEntity("sess-expired");
    expect(result).toBeNull();
    expect(mockTableClient.deleteEntity).toHaveBeenCalledWith(
      "sess",
      "sess-expired"
    );
  });

  test("returns null for 404 error", async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 });
    const result = await getSessionEntity("sess-missing");
    expect(result).toBeNull();
  });

  test("rethrows non-404 errors", async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 500 });
    await expect(getSessionEntity("sess-error")).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

describe("updateSessionEntity", () => {
  test("merges copilot cache updates", async () => {
    mockTableClient.updateEntity.mockResolvedValue();
    await updateSessionEntity("sess-upd", {
      copilotCache: {
        token: "new_tok",
        baseUrl: "https://api.copilot.com",
        expiresAt: 12345,
      },
    });
    expect(mockTableClient.updateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        partitionKey: "sess",
        rowKey: "sess-upd",
        copilotToken: "new_tok",
        copilotBaseUrl: "https://api.copilot.com",
        copilotExpiresAt: 12345,
      }),
      "Merge"
    );
  });

  test("ignores 404 on update (session already deleted)", async () => {
    mockTableClient.updateEntity.mockRejectedValue({ statusCode: 404 });
    await expect(
      updateSessionEntity("sess-gone", { copilotCache: { token: "t" } })
    ).resolves.not.toThrow();
  });

  test("rethrows non-404 errors", async () => {
    mockTableClient.updateEntity.mockRejectedValue({ statusCode: 500 });
    await expect(
      updateSessionEntity("sess-err", { copilotCache: { token: "t" } })
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("deleteSessionEntity", () => {
  test("deletes the session entity", async () => {
    mockTableClient.deleteEntity.mockResolvedValue();
    await deleteSessionEntity("sess-del");
    expect(mockTableClient.deleteEntity).toHaveBeenCalledWith(
      "sess",
      "sess-del"
    );
  });

  test("ignores 404 on delete", async () => {
    mockTableClient.deleteEntity.mockRejectedValue({ statusCode: 404 });
    await expect(deleteSessionEntity("sess-already-gone")).resolves.not.toThrow();
  });

  test("rethrows non-404 errors", async () => {
    mockTableClient.deleteEntity.mockRejectedValue({ statusCode: 500 });
    await expect(deleteSessionEntity("sess-del-err")).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
