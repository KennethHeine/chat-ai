# Testing

This document describes the test setup, how to run tests, and what each test
suite covers.

---

## Prerequisites

- Node.js 18+
- Dependencies installed in both root and `api/`:

  ```bash
  npm install
  cd api && npm install
  ```

---

## Running Tests

The project has two separate test roots — one for the Express server and
frontend, and one for the Azure Functions API backend.

### Server + Frontend tests

```bash
npm test
```

Runs tests in `server/` and `public/` using [Jest](https://jestjs.io/) with
`jest-environment-jsdom` for frontend DOM tests.

### API (Azure Functions) tests

```bash
cd api
npm test
```

Runs tests in `api/src/utils/` using Jest.

### Run everything

```bash
npm test && cd api && npm test
```

---

## Test Suites

### Server — `server/auth.test.js`

Integration tests for the Express auth routes. Spins up a real Express server
on a random port and makes HTTP requests.

| Test | Description |
| ---- | ----------- |
| `GET /auth/github` | Redirects to GitHub OAuth when `GITHUB_CLIENT_ID` is set |
| `GET /auth/github` | Returns 500 when `GITHUB_CLIENT_ID` is missing |
| `GET /auth/github/callback` | Returns 400 when authorization code is missing |
| `GET /auth/me` | Returns 401 when not authenticated |
| `GET /auth/copilot-token` | Returns 401 when not authenticated |
| `POST /auth/logout` | Returns `{ ok: true }` |

### Frontend — `public/app.test.js`

Unit tests for the frontend JavaScript in `public/app.js`. Uses
`jest-environment-jsdom` to simulate a browser DOM. Tests exercise the real
exported functions (`showLogin`, `showChat`, `appendMessage`,
`handleChatResponse`, `checkAuth`) and the logout button click handler.

| Area | What's tested |
| ---- | ------------- |
| `showLogin` | Toggles correct CSS classes on login/chat screens |
| `showChat` | Hides login, shows chat, sets avatar and username |
| `appendMessage` | Adds `div.msg.user` / `div.msg.assistant` to `#messages` |
| `handleChatResponse` | Renders reply, handles errors, shows fallback for empty/missing choices |
| `checkAuth` | Calls `showChat` or `showLogin` based on `/api/auth/me` response; handles fetch errors |
| Logout button | Clears messages and calls `showLogin` on click |

### API — `api/src/utils/rate-limit.test.js`

Unit tests for the in-memory per-IP, per-route rate limiter.

| Test | Description |
| ---- | ----------- |
| Allows requests under the limit | Single request within quota succeeds |
| Blocks when limit reached | Returns `allowed: false` with `retryAfter` |
| Stricter limit for unknown IP | `UNKNOWN_IP_MAX` (5) overrides higher limits |
| Routes tracked independently | Separate counters per route name |
| IPs tracked independently | Different IPs don't share counters |
| `x-forwarded-for` parsing | Uses first entry from comma-separated list |
| `client-ip` fallback | Falls back to `client-ip` header |
| Default `maxRequests` | Defaults to 60 when not specified |
| `rateLimitResponse` | Returns 429 with `Retry-After` header |

### API — `api/src/utils/crypto.test.js`

Unit tests for AES-256-GCM encryption used by session cookies.

| Test | Description |
| ---- | ----------- |
| Round-trip | Encrypts then decrypts back to the original text |
| Random IV | Same plaintext produces different ciphertexts |
| Empty string | Handles empty input |
| Unicode | Handles special characters and emoji |
| Tamper detection | Throws on modified ciphertext |
| Dev default key | Uses insecure default in development and logs a warning |
| Production error | Throws when `SESSION_SECRET` is missing in production |

### API — `api/src/utils/session.test.js`

Unit tests for session cookie management. Mocks `session-store` to isolate the
cookie logic.

| Area | What's tested |
| ---- | ------------- |
| `createSession` | Returns `Set-Cookie` header with `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` |
| `createSession` | Includes `Secure` flag in production, omits in development |
| `getSession` | Parses session ID from cookie, returns session data |
| `getSession` | Returns `null` when cookie is missing or store throws |
| `updateSession` | Delegates to session store; no-op without a cookie |
| `destroySession` | Deletes session and returns expired cookie (`Max-Age=0`) |

### API — `api/src/utils/session-store.test.js`

Unit tests for Azure Table Storage session operations. Mocks `@azure/data-tables`
`TableClient`.

| Area | What's tested |
| ---- | ------------- |
| `createSessionEntity` | Creates table + entity; handles 409 (table exists); rethrows other errors |
| `getSessionEntity` | Returns session data; includes `copilotCache` when present; deletes expired sessions; returns `null` on 404 |
| `updateSessionEntity` | Merges copilot cache fields; ignores 404; rethrows other errors |
| `deleteSessionEntity` | Deletes entity; ignores 404; rethrows other errors |

---

## Writing New Tests

- Place test files next to the module they test with a `.test.js` suffix.
- Server and frontend tests go in `server/` and `public/` respectively.
- API tests go in `api/src/utils/` (or wherever the module lives under `api/`).
- Use `jest.mock()` to mock external dependencies (Azure SDK, fetch, etc.).
- Frontend tests that need a DOM should use the `@jest-environment jsdom`
  docblock pragma at the top of the file.
