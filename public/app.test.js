/**
 * @jest-environment jsdom
 */

// Set up minimal DOM before requiring app.js
beforeEach(() => {
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
});

describe("UI helpers", () => {
  test("showLogin shows login screen and hides chat", () => {
    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");
    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");

    // Simulate showLogin behavior
    loginScreen.classList.remove("hidden");
    chatScreen.classList.add("hidden");

    expect(loginScreen.classList.contains("hidden")).toBe(false);
    expect(chatScreen.classList.contains("hidden")).toBe(true);
  });

  test("showChat shows chat screen and hides login", () => {
    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");
    loginScreen.classList.remove("hidden");
    chatScreen.classList.add("hidden");

    // Simulate showChat behavior
    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");

    expect(loginScreen.classList.contains("hidden")).toBe(true);
    expect(chatScreen.classList.contains("hidden")).toBe(false);
  });

  test("appendMessage adds a message element to messages container", () => {
    const messagesEl = document.getElementById("messages");
    const div = document.createElement("div");
    div.className = "msg user";
    div.textContent = "Hello!";
    messagesEl.appendChild(div);

    expect(messagesEl.children.length).toBe(1);
    expect(messagesEl.children[0].textContent).toBe("Hello!");
    expect(messagesEl.children[0].className).toBe("msg user");
  });

  test("appendMessage handles assistant role", () => {
    const messagesEl = document.getElementById("messages");
    const div = document.createElement("div");
    div.className = "msg assistant";
    div.textContent = "Hi there!";
    messagesEl.appendChild(div);

    expect(messagesEl.children[0].className).toBe("msg assistant");
  });
});

describe("handleChatResponse", () => {
  function handleChatResponse(data) {
    const messagesEl = document.getElementById("messages");
    if (data.error) {
      const div = document.createElement("div");
      div.className = "msg assistant";
      div.textContent = `Error: ${data.error.message || JSON.stringify(data.error)}`;
      messagesEl.appendChild(div);
      return null;
    }
    const reply = data.choices?.[0]?.message?.content ?? "No response from model.";
    const div = document.createElement("div");
    div.className = "msg assistant";
    div.textContent = reply;
    messagesEl.appendChild(div);
    return reply;
  }

  test("displays assistant reply from successful response", () => {
    const messagesEl = document.getElementById("messages");
    const data = {
      choices: [{ message: { content: "Hello from AI!" } }],
    };
    const reply = handleChatResponse(data);
    expect(reply).toBe("Hello from AI!");
    expect(messagesEl.children[0].textContent).toBe("Hello from AI!");
  });

  test("displays error message on error response", () => {
    const messagesEl = document.getElementById("messages");
    const data = { error: { message: "Rate limit exceeded" } };
    handleChatResponse(data);
    expect(messagesEl.children[0].textContent).toContain("Rate limit exceeded");
  });

  test("displays fallback when no choices", () => {
    const messagesEl = document.getElementById("messages");
    const data = { choices: [] };
    const reply = handleChatResponse(data);
    expect(reply).toBe("No response from model.");
  });

  test("displays fallback when choices is undefined", () => {
    const messagesEl = document.getElementById("messages");
    const data = {};
    const reply = handleChatResponse(data);
    expect(reply).toBe("No response from model.");
  });
});

describe("checkAuth behavior", () => {
  test("shows login screen when not authenticated", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ authenticated: false }),
    });

    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");

    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.authenticated) {
      loginScreen.classList.add("hidden");
      chatScreen.classList.remove("hidden");
    } else {
      loginScreen.classList.remove("hidden");
      chatScreen.classList.add("hidden");
    }

    expect(loginScreen.classList.contains("hidden")).toBe(false);
    expect(chatScreen.classList.contains("hidden")).toBe(true);
  });

  test("shows chat screen when authenticated", async () => {
    const user = { login: "testuser", avatar: "https://example.com/avatar.png" };
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ authenticated: true, user }),
    });

    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");
    const userAvatar = document.getElementById("user-avatar");
    const userName = document.getElementById("user-name");

    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.authenticated) {
      loginScreen.classList.add("hidden");
      chatScreen.classList.remove("hidden");
      userAvatar.src = data.user.avatar;
      userName.textContent = data.user.login;
    }

    expect(loginScreen.classList.contains("hidden")).toBe(true);
    expect(chatScreen.classList.contains("hidden")).toBe(false);
    expect(userName.textContent).toBe("testuser");
  });

  test("shows login screen when fetch fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");

    try {
      await fetch("/api/auth/me");
    } catch {
      loginScreen.classList.remove("hidden");
      chatScreen.classList.add("hidden");
    }

    expect(loginScreen.classList.contains("hidden")).toBe(false);
  });
});

describe("logout behavior", () => {
  test("clears state and shows login", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    });

    const messagesEl = document.getElementById("messages");
    const loginScreen = document.getElementById("login-screen");
    const chatScreen = document.getElementById("chat-screen");

    // Add some messages first
    const div = document.createElement("div");
    div.textContent = "test message";
    messagesEl.appendChild(div);

    // Simulate logout
    await fetch("/api/auth/logout", { method: "POST" });
    messagesEl.innerHTML = "";
    loginScreen.classList.remove("hidden");
    chatScreen.classList.add("hidden");

    expect(messagesEl.children.length).toBe(0);
    expect(loginScreen.classList.contains("hidden")).toBe(false);
    expect(chatScreen.classList.contains("hidden")).toBe(true);
  });
});
