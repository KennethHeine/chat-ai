# Chat AI

A simple chat application with GitHub OAuth authentication and the GitHub Copilot
OpenAI-compatible API. The frontend calls the Copilot API directly — the backend
only handles authentication and token exchange.

## Prerequisites

- Node.js 18+
- A [GitHub OAuth App](https://github.com/settings/developers) with the callback URL set to `http://localhost:3000/auth/github/callback`
- A GitHub account with an active Copilot subscription

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example env file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable               | Description                             |
   | ---------------------- | --------------------------------------- |
   | `GITHUB_CLIENT_ID`     | OAuth App client ID                     |
   | `GITHUB_CLIENT_SECRET` | OAuth App client secret                 |
   | `SESSION_SECRET`       | Random string used to sign the session  |
   | `PORT`                 | Server port (default `3000`)            |

3. Start the server:

   ```bash
   npm start
   ```

4. Open <http://localhost:3000> and sign in with GitHub.

## Architecture

```
Browser                          Copilot API
  │                                  ▲
  │  1. OAuth login                  │  5. Direct chat calls
  │  2. Get Copilot token            │     (using Copilot token)
  ▼                                  │
Express Backend (auth only)          │
  /auth/github           ────────────┘
  /auth/github/callback
  /auth/copilot-token
  /auth/me
  /auth/logout
```

```
public/            – static frontend (HTML / CSS / JS)
server/
  index.js         – Express server entry point
  auth.js          – GitHub OAuth + Copilot token exchange
docs/
  copilot-api-spec.md        – Full Copilot API specification
  setup-and-integration.md   – Detailed setup and integration guide
```

## Documentation

- **[Copilot API Specification](docs/copilot-api-spec.md)** — complete API
  reference for authentication, token exchange, chat completions, models, and
  quota endpoints.
- **[Setup and Integration Guide](docs/setup-and-integration.md)** — step-by-step
  walkthrough for creating the OAuth app, configuring the environment, and
  understanding the data flow.
