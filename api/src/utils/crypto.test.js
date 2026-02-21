describe("crypto utils", () => {
  let encrypt, decrypt;

  beforeEach(() => {
    jest.resetModules();
    process.env.SESSION_SECRET = "test-secret-key";
    ({ encrypt, decrypt } = require("./crypto"));
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  test("encrypts and decrypts text correctly", () => {
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test("produces different ciphertexts for the same input (random IV)", () => {
    const plaintext = "same input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  test("handles empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  test("handles special characters and unicode", () => {
    const text = "héllo wörld! 🎉 日本語";
    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  test("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret data");
    const tampered = encrypted.slice(0, -2) + "XX";
    expect(() => decrypt(tampered)).toThrow();
  });

  test("uses dev default key when SESSION_SECRET not set in development", () => {
    jest.resetModules();
    delete process.env.SESSION_SECRET;
    delete process.env.NODE_ENV;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { encrypt: devEncrypt, decrypt: devDecrypt } = require("./crypto");
    const encrypted = devEncrypt("dev test");
    expect(devDecrypt(encrypted)).toBe("dev test");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SESSION_SECRET is not set")
    );
    warnSpy.mockRestore();
  });

  test("throws when SESSION_SECRET not set in production", () => {
    jest.resetModules();
    delete process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";
    expect(() => {
      const { encrypt: prodEncrypt } = require("./crypto");
      prodEncrypt("test");
    }).toThrow("SESSION_SECRET is not set");
    delete process.env.NODE_ENV;
  });
});
