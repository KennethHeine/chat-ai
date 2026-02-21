# Setup and Integration Guide

This guide walks through the complete setup of the Chat AI application, which
uses GitHub OAuth for authentication and the GitHub Copilot API for chat
completions. The frontend calls the Copilot API directly — the backend only
handles authentication and token exchange.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                      Browser                         │
│                                                      │
│  1. User clicks "Sign in with GitHub"                │
│  2. Redirected to GitHub OAuth                       │
│  3. Callback returns to backend with auth code       │
│  4. Frontend fetches Copilot token from backend      │
│  5. Frontend calls Copilot API directly              │
└───────────┬──────────────────────┬───────────────────┘
            │                      │
     Auth only                Direct API calls
            │                      │
  ┌─────────▼──────────┐   ┌──────▼─────────────────────┐
  │   Express Backend   │   │   Copilot API               │
  │   (local dev) or    │   │   api.individual.            │
  │   Azure Functions   │   │     githubcopilot.com       │
  │                     │   │                             │
  │  /auth/github       │   │  POST /chat/completions     │
  │  /auth/github/      │   │                             │
  │    callback         │   └─────────────────────────────┘
  │  /auth/copilot-     │
  │    token            │
  │  /auth/me           │           ┌─────────────────────┐
  │  /auth/logout       │           │  Azure Table Storage │
  └──┬──────────────────┘           │  (sessions table)    │
     │    session CRUD              │  Managed Identity    │
     ├─────────────────────────────>│  + RBAC              │
     │                              └─────────────────────┘
     │    secrets (deploy-time)
     │                              ┌─────────────────────┐
     └─────────────────────────────>│  Azure Key Vault     │
                                    │  (OAuth secrets)     │
                                    │  Bicep getSecret()   │
                                    └─────────────────────┘
```

### Data Flow

1. User clicks **Sign in with GitHub** → browser redirects to GitHub OAuth
2. User authorizes → GitHub redirects back with an authorization `code`
3. Backend exchanges the `code` for a **GitHub access token** (kept server-side)
4. Backend fetches user profile and stores token + profile in **Azure Table
   Storage** (or in-memory for local dev)
5. Backend sets an **opaque session ID cookie** (no token material in cookie)
6. Frontend calls `GET /auth/copilot-token` → backend looks up the session in
   Table Storage, exchanges the GitHub access token for a short-lived **Copilot
   API token**, caches it server-side, and returns it
7. Frontend calls `POST {baseUrl}/chat/completions` directly with the Copilot
   token
8. If the Copilot token expires, frontend fetches a fresh one from the backend

---

## Prerequisites

- **Node.js** 18 or later
- A **GitHub account** with an active Copilot subscription
- A **GitHub OAuth App** (create one at <https://github.com/settings/developers>)

---

## Step 1 — Create a GitHub OAuth App

1. Go to <https://github.com/settings/developers>
2. Click **New OAuth App**
3. Fill in the fields:

   | Field                       | Value                                        |
   | --------------------------- | -------------------------------------------- |
   | Application name            | `Chat AI` (or any name)                      |
   | Homepage URL                | `http://localhost:3000`                       |
   | Authorization callback URL  | `http://localhost:3000/auth/github/callback`  |

4. Click **Register application**
5. Copy the **Client ID**
6. Generate and copy a **Client Secret**

---

## Step 2 — Configure the Application

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret
SESSION_SECRET=any_random_string_for_signing_sessions
PORT=3000
```

| Variable               | Required | Description                                    |
| ---------------------- | -------- | ---------------------------------------------- |
| `GITHUB_CLIENT_ID`     | Yes      | From your GitHub OAuth App                     |
| `GITHUB_CLIENT_SECRET` | Yes      | From your GitHub OAuth App                     |
| `SESSION_SECRET`       | Prod     | Random string to sign session cookies          |
| `PORT`                 | No       | Server port (default `3000`)                   |

---

## Step 3 — Install and Run

```bash
npm install
npm start
```

Open <http://localhost:3000> in your browser.

For development with auto-reload:

```bash
npm run dev
```

---

## Step 4 — Sign In and Chat

1. Click **Sign in with GitHub**
2. Authorize the OAuth App on GitHub
3. You are redirected back to the chat interface
4. Select a model from the dropdown and start chatting

---

## How the Copilot Integration Works

### GitHub OAuth (Backend)

The backend handles the standard OAuth authorization code flow:

1. `GET /auth/github` — redirects the user to GitHub's authorize page
2. `GET /auth/github/callback?code=...` — receives the callback, exchanges the
   code for a GitHub access token, fetches the user's profile, stores both in
   the server-side session
3. `GET /auth/me` — returns the current user if authenticated
4. `POST /auth/logout` — destroys the session

### Copilot Token Exchange (Backend)

The GitHub access token cannot be used directly against the Copilot API. It must
be exchanged for a short-lived Copilot token:

```
GET https://api.github.com/copilot_internal/v2/token
Authorization: Bearer <github_access_token>
```

The response includes:

- `token` — a semicolon-delimited string containing a `proxy-ep` field
- `expires_at` — Unix timestamp

The backend caches this token in the server-side session (Table Storage) and
refreshes it 5 minutes before expiry. The `proxy-ep` field is parsed to derive
the API base URL:

```
proxy-ep=proxy.individual.githubcopilot.com
         → https://api.individual.githubcopilot.com
```

### Chat API (Frontend → Copilot directly)

The frontend fetches the Copilot token from `GET /auth/copilot-token` and calls
the Copilot API directly:

```
POST https://api.individual.githubcopilot.com/chat/completions
Authorization: Bearer <copilot_api_token>
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [...],
  "max_tokens": 4096,
  "stream": false
}
```

If the API returns a 401/403 (token expired), the frontend automatically
requests a fresh token from the backend and retries.

---

## File Structure

```
chat-ai/
├── .env.example           Environment variable template
├── package.json           Project metadata and scripts
├── api/
│   ├── package.json       Azure Functions dependencies
│   └── src/
│       ├── functions/     HTTP-triggered Azure Functions
│       │   ├── auth-github.js
│       │   ├── auth-callback.js
│       │   ├── auth-me.js
│       │   ├── auth-copilot-token.js
│       │   └── auth-logout.js
│       └── utils/
│           ├── session.js          Opaque session ID cookie management
│           └── session-store.js    Azure Table Storage session CRUD
├── docs/
│   ├── authentication-flow.md   Full auth + session architecture
│   ├── copilot-api-spec.md      Copilot API specification
│   ├── secrets.md               Required secrets reference
│   └── setup-and-integration.md This document
├── infra/
│   ├── keyvault.bicep     Bicep: Key Vault + deployer RBAC
│   ├── main.bicep         Bicep: SWA + Storage + KV refs + RBAC + app settings
│   └── modules/
│       └── swa-appsettings.bicep  SWA app settings (accepts @secure params)
├── public/
│   ├── index.html         Login and chat UI
│   ├── style.css          Dark-themed styles
│   └── app.js             Frontend logic (auth + direct Copilot calls)
└── server/
    ├── index.js           Express server (sessions, static files, CSRF)
    └── auth.js            OAuth flow + Copilot token exchange (local dev)
```

---

## Security Considerations

| Concern             | Mitigation                                                        |
| ------------------- | ----------------------------------------------------------------- |
| GitHub token leak   | Stored server-side in Table Storage, never sent to browser        |
| Session cookie      | Opaque random ID only — no token material in the cookie           |
| Table Storage access| Managed Identity + RBAC (Storage Table Data Contributor); no keys |
| Secret management   | OAuth secrets in Key Vault; injected via Bicep `getSecret()` at deploy time |
| CSRF                | Origin header check + `sameSite: lax` cookies                     |
| Session hijacking   | `httpOnly` cookies; `secure: true` in production                  |
| Copilot token scope | Short-lived; auto-refreshed; cached server-side with 5-min margin |
| Session expiry      | Server-side TTL (24 h); expired sessions deleted on access        |

---

## Available Models

| Model ID        | Context Window | Max Output Tokens |
| --------------- | -------------- | ----------------- |
| `gpt-4o`        | 128 000        | 8 192             |
| `gpt-4.1`       | 128 000        | 8 192             |
| `gpt-4.1-mini`  | 128 000        | 8 192             |
| `gpt-4.1-nano`  | 128 000        | 8 192             |
| `o1`            | 128 000        | 8 192             |
| `o1-mini`       | 128 000        | 8 192             |
| `o3-mini`       | 128 000        | 8 192             |

Model availability depends on the user's Copilot subscription plan.

---

## Troubleshooting

| Issue                          | Solution                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| "GITHUB_CLIENT_ID not configured" | Set `GITHUB_CLIENT_ID` in your `.env` file                |
| "Token exchange failed"        | Verify your GitHub account has an active Copilot subscription |
| CORS errors in browser console | The Copilot API must allow cross-origin requests; if blocked, check the base URL from token exchange |
| "Not authenticated" on chat    | Sign in again — your session may have expired                |
