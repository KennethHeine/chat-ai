# Local Development Guide

This guide explains how to run the Chat AI app on your local machine using the
Express dev server (`server/`).

---

## Prerequisites

- **Node.js 22**
- A **GitHub account** with an active Copilot subscription
- A **GitHub OAuth App** configured for local dev (see below)

---

## 1. Create a GitHub OAuth App for Local Dev

Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.

| Field | Value |
|---|---|
| Application name | `chat-ai (local dev)` |
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/auth/github/callback` |

> **Note:** The production app uses a separate OAuth App with callback URL
> `https://chat.kscloud.io/api/auth/github/callback`. Keep them separate — one
> for local dev, one for production.

After creating the app, note the **Client ID** and generate a **Client Secret**.

---

## 2. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GITHUB_CLIENT_ID=<your local dev OAuth App client ID>
GITHUB_CLIENT_SECRET=<your local dev OAuth App client secret>
PORT=3000
SESSION_SECRET=<any random string>
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
```

> `.env` is git-ignored — never commit it.

---

## 3. Install Dependencies

```bash
npm install
```

---

## 4. Start the Server

```bash
npm run dev
```

The server starts with `--watch` (auto-restarts on file changes) at
<http://localhost:3000>.

To run without watch mode:

```bash
npm start
```

---

## 5. Sign In

Open <http://localhost:3000> in your browser and click **Sign in with GitHub**.

The auth flow uses these local routes (served by Express, **not** Azure Functions):

| Route | Description |
|---|---|
| `GET /auth/github` | Redirects to GitHub OAuth |
| `GET /auth/github/callback` | Handles the OAuth callback |
| `GET /auth/copilot-token` | Returns a Copilot API token |
| `GET /auth/me` | Returns the signed-in user profile |
| `POST /auth/logout` | Clears the session |

> **Note:** The Express dev server handles both `/auth/...` and `/api/auth/...` — the frontend uses `/api/auth/...` and that works fine locally too.

---

## 6. Run Tests

```bash
npm test              # server + frontend tests
cd api && npm test    # API (Azure Functions) tests
```

See [testing.md](testing.md) for full details.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `GITHUB_CLIENT_ID is not configured` | `.env` not loaded / missing `dotenv` | Ensure `dotenv` is installed (`npm install`) and the server loads it (`require("dotenv").config()` at the top of `server/index.js`) |
| `redirect_uri_mismatch` from GitHub | Callback URL mismatch | Make sure the OAuth App callback is exactly `http://localhost:3000/auth/github/callback` |
| Session not persisting | `SESSION_SECRET` not set | Add `SESSION_SECRET` to your `.env` |
| Port already in use | Another process on 3000 | Change `PORT=3001` in `.env` (and update the GitHub OAuth App callback URL accordingly) |
