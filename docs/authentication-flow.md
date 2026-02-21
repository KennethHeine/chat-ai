# Authentication Flow

This document describes how authentication works in the Chat AI application,
from the initial GitHub login through to calling the Copilot API.

---

## Overview

The app uses a two-stage authentication flow:

1. **GitHub OAuth** — the user signs in with GitHub using the
   [authorization code flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow),
   which gives the backend a GitHub access token.
2. **Copilot token exchange** — the backend exchanges the GitHub access token
   for a short-lived Copilot API token, which the frontend uses to call the
   Copilot chat completions API directly.

All sensitive tokens (GitHub access token, Copilot token) are stored
**server-side** in Azure Table Storage. The browser only receives an opaque
session ID cookie — no token material is ever sent to the client.

```
┌────────────┐       ┌────────────┐       ┌──────────────┐       ┌──────────────────┐
│   Browser  │       │   Backend  │       │  GitHub OAuth │       │   Copilot API    │
│ (Frontend) │       │ (Functions)│       │   Server     │       │                  │
└─────┬──────┘       └─────┬──────┘       └──────┬───────┘       └────────┬─────────┘
      │  1. Click login     │                     │                       │
      │────────────────────>│                     │                       │
      │  2. Redirect        │                     │                       │
      │<────────────────────│                     │                       │
      │  3. Authorize       │                     │                       │
      │──────────────────────────────────────────>│                       │
      │  4. Redirect + code │                     │                       │
      │<──────────────────────────────────────────│                       │
      │  5. code            │                     │                       │
      │────────────────────>│  6. Exchange code   │                       │
      │                     │────────────────────>│                       │
      │                     │  7. Access token    │                       │
      │                     │<────────────────────│                       │
      │                     │  8. Store session   │                       │
      │                     │  ──> Table Storage  │                       │
      │  9. Set session cookie (opaque ID only)   │                       │
      │<────────────────────│                     │                       │
      │  10. GET /copilot-token                   │                       │
      │────────────────────>│  11. Lookup session │                       │
      │                     │  <── Table Storage  │                       │
      │                     │  12. Exchange token │                       │
      │                     │─────────────────────────────────────────────>│ (GitHub API)
      │                     │  13. Copilot token  │                       │
      │                     │<─────────────────────────────────────────────│
      │                     │  14. Cache in Table │                       │
      │                     │  ──> Table Storage  │                       │
      │  15. Copilot token  │                     │                       │
      │<────────────────────│                     │                       │
      │  16. POST /chat/completions               │                       │
      │───────────────────────────────────────────────────────────────────>│
      │  17. Chat response  │                     │                       │
      │<──────────────────────────────────────────────────────────────────│
```

---

## Step 1: GitHub OAuth (Authorization Code Flow)

The app uses a standard
[GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
with the
[web application flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow).

### 1.1 — Initiate login

The user clicks **Sign in with GitHub**. The browser navigates to:

```
GET /api/auth/github
```

The backend redirects to GitHub's authorization endpoint:

```
https://github.com/login/oauth/authorize?client_id=<CLIENT_ID>&scope=read:user
```

- **`client_id`** — the OAuth App's client ID
  ([docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity))
- **`scope`** — `read:user` grants access to the user's profile
  ([docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes))

### 1.2 — User authorizes

GitHub shows a consent screen. The user clicks **Authorize**. GitHub redirects
back to the configured callback URL with a temporary authorization code:

```
GET /api/auth/github/callback?code=<AUTHORIZATION_CODE>
```

### 1.3 — Exchange code for access token

The backend exchanges the authorization code for an access token by calling
GitHub's token endpoint server-side:

```http
POST https://github.com/login/oauth/access_token
Content-Type: application/json
Accept: application/json

{
  "client_id": "<CLIENT_ID>",
  "client_secret": "<CLIENT_SECRET>",
  "code": "<AUTHORIZATION_CODE>"
}
```

GitHub responds with:

```json
{
  "access_token": "ghu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "token_type": "bearer",
  "scope": "read:user"
}
```

> **Reference:**
> [Exchanging a code for an access token](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github)

### 1.4 — Fetch user profile

The backend uses the access token to fetch the authenticated user's profile:

```http
GET https://api.github.com/user
Authorization: Bearer <ACCESS_TOKEN>
```

The response includes `login` (username) and `avatar_url`, which are stored in
the server-side session.

> **Reference:**
> [Get the authenticated user](https://docs.github.com/en/rest/users/users#get-the-authenticated-user)

### 1.5 — Create server-side session

The backend creates a session record in **Azure Table Storage** and sets an
opaque session ID cookie on the response. No token material leaves the server.

#### Session entity (Table Storage)

| Field              | Value                                               |
| ------------------ | --------------------------------------------------- |
| `PartitionKey`     | `"sess"`                                            |
| `RowKey`           | Cryptographically random ID (256-bit, base64url)    |
| `githubToken`      | The GitHub access token                             |
| `userLogin`        | GitHub username                                     |
| `userAvatar`       | GitHub avatar URL                                   |
| `copilotToken`     | _(empty until first exchange)_                      |
| `copilotBaseUrl`   | _(empty until first exchange)_                      |
| `copilotExpiresAt` | _(0 until first exchange)_                          |
| `sessionExpiresAt` | `Date.now() + 86 400 000` (24 h)                    |

#### Session cookie

| Attribute   | Value                                                     |
| ----------- | --------------------------------------------------------- |
| Name        | `session`                                                 |
| Value       | Opaque random ID (≥ 256-bit, base64url)                   |
| `HttpOnly`  | Always set — prevents JavaScript access                   |
| `Secure`    | Set in production only — requires HTTPS                   |
| `SameSite`  | `Lax` — protects against CSRF                             |
| `Max-Age`   | 86 400 seconds (24 hours, configurable via `SESSION_MAX_AGE`) |

The user is then redirected to `/` (the chat UI).

---

## Step 2: Copilot Token Exchange

The GitHub access token cannot be used directly with the Copilot API. It must be
exchanged for a short-lived Copilot API token.

### 2.1 — Frontend requests a token

When the user sends their first chat message, the frontend calls:

```
GET /api/auth/copilot-token
```

### 2.2 — Backend looks up the session and exchanges the token

The backend reads the opaque session ID from the cookie, fetches the session
entity from Table Storage, and calls GitHub's internal Copilot token endpoint:

```http
GET https://api.github.com/copilot_internal/v2/token
Authorization: Bearer <GITHUB_ACCESS_TOKEN>
Accept: application/json
```

The response includes:

```json
{
  "token": "tid=abc;exp=1700000000;sku=free;proxy-ep=proxy.individual.githubcopilot.com;...",
  "expires_at": 1700000000
}
```

- **`token`** — a semicolon-delimited string used as a Bearer token for Copilot
  API calls
- **`expires_at`** — Unix timestamp when the token expires

### 2.3 — Derive the API base URL

The `proxy-ep` field in the token string determines the Copilot API base URL:

```
proxy-ep=proxy.individual.githubcopilot.com
         → https://api.individual.githubcopilot.com
```

### 2.4 — Cache the token server-side

The Copilot token, base URL, and expiry are written back to the session entity
in Table Storage. The token is reused until it is within 5 minutes of expiry,
minimizing calls to GitHub.

### 2.5 — Return to frontend

The backend returns the Copilot token and base URL to the frontend:

```json
{
  "token": "<COPILOT_TOKEN>",
  "baseUrl": "https://api.individual.githubcopilot.com"
}
```

---

## Step 3: Chat API Calls

The frontend calls the Copilot API directly using the Copilot token:

```http
POST https://api.individual.githubcopilot.com/chat/completions
Authorization: Bearer <COPILOT_TOKEN>
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "max_tokens": 4096,
  "stream": false
}
```

If the API returns **401** or **403** (token expired), the frontend
automatically requests a fresh Copilot token from the backend and retries.

---

## Step 4: Logout

The user clicks **Logout**, which sends:

```
POST /api/auth/logout
```

The backend deletes the session entity from Table Storage and clears the session
cookie (sets `Max-Age=0`). The frontend clears its in-memory state and shows the
login screen.

CSRF protection: the backend validates the `Origin` header on POST requests to
ensure the request originates from the same site.

---

## Security Summary

| Concern | Mitigation |
| --- | --- |
| GitHub token exposure | Stored server-side in Azure Table Storage; never sent to browser |
| Session cookie content | Opaque random ID only — no token material in the cookie |
| Table Storage access | Managed Identity + RBAC (Storage Table Data Contributor); no storage keys |
| Secret management | OAuth secrets in Azure Key Vault; injected via Bicep `getSecret()` at deploy time |
| CSRF | Origin header validation + `SameSite=Lax` cookies |
| Session hijacking | `HttpOnly` cookies; `Secure` flag in production |
| Copilot token lifetime | Short-lived; auto-refreshed; cached server-side with 5-min margin |
| Session expiry | Server-side TTL (24 h); expired sessions deleted on access |

---

## Related Documentation

- [Creating an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- [Authorizing OAuth Apps (Web Application Flow)](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow)
- [Scopes for OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [Get the authenticated user](https://docs.github.com/en/rest/users/users#get-the-authenticated-user)
- [Azure Table Storage](https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview)
- [Managed Identities for Azure resources](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview)
- [Use GitHub Actions to connect to Azure (OIDC)](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure?tabs=azure-portal%2Clinux#use-the-azure-login-action-with-openid-connect)
