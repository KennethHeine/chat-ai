# Chat AI

A simple chat application with GitHub OAuth authentication and the GitHub Copilot OpenAI-compatible API.

## Prerequisites

- Node.js 18+
- A [GitHub OAuth App](https://github.com/settings/developers) with the callback URL set to `http://localhost:3000/auth/github/callback`
- A GitHub account with access to GitHub Copilot

## Setup

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
public/          – static frontend (HTML / CSS / JS)
server/
  index.js       – Express server entry point
  auth.js        – GitHub OAuth login, callback, session management
  chat.js        – proxies chat messages to the Copilot API
```
