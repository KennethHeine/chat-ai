const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const modelSelect = document.getElementById("model-select");

const history = []; // conversation messages sent to the API
let copilotToken = null;
let copilotBaseUrl = null;

// --------------- Auth helpers ---------------

async function checkAuth() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.authenticated) {
      showChat(data.user);
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

async function fetchCopilotToken() {
  const res = await fetch("/api/auth/copilot-token");
  if (!res.ok) throw new Error("Failed to get Copilot token");
  const data = await res.json();
  copilotToken = data.token;
  copilotBaseUrl = data.baseUrl;
}

async function fetchModels() {
  try {
    const res = await fetch("/api/auth/models");
    if (!res.ok) throw new Error("Failed to fetch models");
    const data = await res.json();
    modelSelect.innerHTML = "";
    for (const model of data.models) {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name;
      modelSelect.appendChild(option);
    }
    const preferred = localStorage.getItem("preferred-model");
    const preferredExists = preferred && Array.from(modelSelect.options).some((o) => o.value === preferred);
    if (preferredExists) {
      modelSelect.value = preferred;
    } else if (modelSelect.options.length > 0) {
      modelSelect.value = modelSelect.options[0].value;
    }
  } catch {
    // Keep any existing options so the user can still chat
  }
}

// --------------- UI helpers ---------------

function showLogin() {
  loginScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
}

function showChat(user) {
  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  userAvatar.src = user.avatar;
  userName.textContent = user.login;
  fetchModels();
}

function appendMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

modelSelect.addEventListener("change", () => {
  localStorage.setItem("preferred-model", modelSelect.value);
});

// --------------- Chat ---------------

async function callCopilot(messages, model) {
  return fetch(`${copilotBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${copilotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096, stream: false }),
  });
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  appendMessage("user", text);
  history.push({ role: "user", content: text });

  try {
    if (!copilotToken) await fetchCopilotToken();

    const model = modelSelect.value;
    let res = await callCopilot(history, model);

    if (res.status === 401 || res.status === 403) {
      await fetchCopilotToken();
      res = await callCopilot(history, model);
    }

    const data = await res.json();
    handleChatResponse(data);
  } catch {
    appendMessage("assistant", "Error: Could not reach the Copilot API.");
  }
});

function handleChatResponse(data) {
  if (data.error) {
    appendMessage("assistant", `Error: ${data.error.message || JSON.stringify(data.error)}`);
  } else {
    const reply = data.choices?.[0]?.message?.content ?? "No response from model.";
    appendMessage("assistant", reply);
    history.push({ role: "assistant", content: reply });
  }
}

// --------------- Logout ---------------

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  history.length = 0;
  messagesEl.innerHTML = "";
  copilotToken = null;
  copilotBaseUrl = null;
  showLogin();
});

// --------------- Exports for testing ---------------

if (typeof module !== "undefined" && module.exports) {
  module.exports = { showLogin, showChat, appendMessage, handleChatResponse, checkAuth, fetchCopilotToken, fetchModels };
} else {
  checkAuth();
}
