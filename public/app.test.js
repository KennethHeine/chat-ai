/**
 * @jest-environment jsdom
 */

let appModule;

function setupDOM() {
  document.body.innerHTML = `
    <div id="login-screen" class="hidden"></div>
    <div id="chat-screen" class="hidden"></div>
    <img id="user-avatar" src="" />
    <span id="user-name"></span>
    <button id="logout-btn"></button>
    <div id="messages"></div>
    <form id="chat-form">
      <input id="chat-input" />
      <select id="model-select"><option value="gpt-4o">gpt-4o</option></select>
    </form>
  `;
}

function loadApp() {
  jest.resetModules();
  return require("./app");
}

beforeEach(() => {
  setupDOM();
  global.fetch = jest.fn();
  appModule = loadApp();
});

afterEach(() => {
  delete global.fetch;
});

describe("showLogin", () => {
  test("shows login screen and hides chat", () => {
    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");
    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");

    appModule.showLogin();

    expect(loginScreen.classList.contains("hidden")).toBe(false);
    expect(chatScreen.classList.contains("hidden")).toBe(true);
  });
});

describe("showChat", () => {
  test("shows chat screen, hides login, and sets user info", () => {
    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");
    const userAvatar = document.getElementById("user-avatar");
    const userName = document.getElementById("user-name");

    appModule.showChat({ login: "alice", avatar: "https://example.com/a.png" });

    expect(loginScreen.classList.contains("hidden")).toBe(true);
    expect(chatScreen.classList.contains("hidden")).toBe(false);
    expect(userAvatar.src).toBe("https://example.com/a.png");
    expect(userName.textContent).toBe("alice");
  });
});

describe("appendMessage", () => {
  test("adds a user message element to the messages container", () => {
    const messagesEl = document.getElementById("messages");

    appModule.appendMessage("user", "Hello!");

    expect(messagesEl.children.length).toBe(1);
    expect(messagesEl.children[0].textContent).toBe("Hello!");
    expect(messagesEl.children[0].className).toBe("msg user");
  });

  test("adds an assistant message element", () => {
    const messagesEl = document.getElementById("messages");

    appModule.appendMessage("assistant", "Hi there!");

    expect(messagesEl.children[0].className).toBe("msg assistant");
    expect(messagesEl.children[0].textContent).toBe("Hi there!");
  });
});

describe("handleChatResponse", () => {
  test("displays assistant reply from successful response", () => {
    const messagesEl = document.getElementById("messages");
    appModule.handleChatResponse({
      choices: [{ message: { content: "Hello from AI!" } }],
    });
    expect(messagesEl.children[0].textContent).toBe("Hello from AI!");
    expect(messagesEl.children[0].className).toBe("msg assistant");
  });

  test("displays error message on error response", () => {
    const messagesEl = document.getElementById("messages");
    appModule.handleChatResponse({ error: { message: "Rate limit exceeded" } });
    expect(messagesEl.children[0].textContent).toContain("Rate limit exceeded");
  });

  test("displays fallback when no choices", () => {
    const messagesEl = document.getElementById("messages");
    appModule.handleChatResponse({ choices: [] });
    expect(messagesEl.children[0].textContent).toBe("No response from model.");
  });

  test("displays fallback when choices is undefined", () => {
    const messagesEl = document.getElementById("messages");
    appModule.handleChatResponse({});
    expect(messagesEl.children[0].textContent).toBe("No response from model.");
  });
});

describe("checkAuth", () => {
  test("calls showChat when authenticated", async () => {
    const user = { login: "testuser", avatar: "https://example.com/avatar.png" };
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ authenticated: true, user }),
    });

    await appModule.checkAuth();

    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");
    const userName = document.getElementById("user-name");
    expect(loginScreen.classList.contains("hidden")).toBe(true);
    expect(chatScreen.classList.contains("hidden")).toBe(false);
    expect(userName.textContent).toBe("testuser");
  });

  test("calls showLogin when not authenticated", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ authenticated: false }),
    });

    await appModule.checkAuth();

    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");
    expect(loginScreen.classList.contains("hidden")).toBe(false);
    expect(chatScreen.classList.contains("hidden")).toBe(true);
  });

  test("calls showLogin when fetch fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    await appModule.checkAuth();

    const loginScreen = document.getElementById("login-screen");
    expect(loginScreen.classList.contains("hidden")).toBe(false);
  });
});

describe("logout button", () => {
  test("clears messages and shows login on click", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    });

    const messagesEl = document.getElementById("messages");
    const logoutBtn = document.getElementById("logout-btn");

    // Add a message first
    appModule.appendMessage("user", "test message");
    expect(messagesEl.children.length).toBe(1);

    // Click logout
    logoutBtn.click();
    // Wait for the async handler to complete
    await new Promise((r) => setTimeout(r, 0));

    expect(messagesEl.children.length).toBe(0);
    const loginScreen = document.getElementById("login-screen");
    expect(loginScreen.classList.contains("hidden")).toBe(false);
  });
});
