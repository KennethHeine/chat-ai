const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

const history = []; // conversation messages sent to the API

async function checkAuth() {
  try {
    const res = await fetch("/auth/me");
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

function showLogin() {
  loginScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
}

function showChat(user) {
  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  userAvatar.src = user.avatar;
  userName.textContent = user.login;
}

function appendMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  appendMessage("user", text);
  history.push({ role: "user", content: text });

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });

    const data = await res.json();
    if (data.error) {
      appendMessage("assistant", `Error: ${data.error}`);
    } else {
      appendMessage("assistant", data.reply);
      history.push({ role: "assistant", content: data.reply });
    }
  } catch {
    appendMessage("assistant", "Error: Could not reach the server.");
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST" });
  history.length = 0;
  messagesEl.innerHTML = "";
  showLogin();
});

checkAuth();
