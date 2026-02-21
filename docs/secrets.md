# Required Secrets

This document describes every secret used by the Chat AI application, where each
one is configured, and why it is needed.

---

## GitHub Actions Workflow Secrets

These secrets are configured in the repository under **Settings → Secrets and
variables → Actions**. They are used by the
[deploy workflow](../.github/workflows/deploy.yml) to authenticate with Azure
and configure the Static Web App.

### `AZURE_CLIENT_ID`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | GitHub Actions OIDC login (`azure/login@v2`) |
| **Purpose** | Identifies the Azure AD application (service principal) that the workflow authenticates as. |
| **Where to find it** | Azure Portal → App registrations → your app → **Application (client) ID** |
| **Docs** | [Configure a federated identity credential on an app](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-create-trust?pivots=identity-wif-apps-methods-azp#github-actions) |

### `AZURE_TENANT_ID`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | GitHub Actions OIDC login (`azure/login@v2`) |
| **Purpose** | Identifies the Azure AD tenant (directory) that owns the service principal. |
| **Where to find it** | Azure Portal → App registrations → your app → **Directory (tenant) ID** |
| **Docs** | [Use GitHub Actions to connect to Azure](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure?tabs=azure-portal%2Clinux#use-the-azure-login-action-with-openid-connect) |

### `AZURE_SUBSCRIPTION_ID`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | GitHub Actions OIDC login (`azure/login@v2`) |
| **Purpose** | Identifies the Azure subscription where resources (resource group `rg-chat-ai`, Static Web App) are deployed. |
| **Where to find it** | Azure Portal → Subscriptions → **Subscription ID** |
| **Docs** | [Use GitHub Actions to connect to Azure](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure?tabs=azure-portal%2Clinux#use-the-azure-login-action-with-openid-connect) |

---

## Application Secrets

These secrets are passed to the Azure Static Web App as **app settings** during
deployment. They are used at runtime by the Azure Functions backend.

### `OAUTH_CLIENT_ID`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | Azure Functions (`auth-github`, `auth-callback`) |
| **App setting** | `GITHUB_CLIENT_ID` |
| **Purpose** | Identifies the GitHub OAuth App when redirecting users to GitHub for login and when exchanging the authorization code for an access token. |
| **Where to find it** | GitHub → Settings → Developer settings → OAuth Apps → your app → **Client ID** |
| **Docs** | [Creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) |

### `OAUTH_CLIENT_SECRET`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | Azure Functions (`auth-callback`) |
| **App setting** | `GITHUB_CLIENT_SECRET` |
| **Purpose** | Authenticates the server when exchanging the OAuth authorization code for a GitHub access token. This secret must never be exposed to the browser. |
| **Where to find it** | GitHub → Settings → Developer settings → OAuth Apps → your app → **Client secrets** → Generate a new client secret |
| **Docs** | [Creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) |

### `SESSION_SECRET`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | Azure Functions (session encryption via `api/src/utils/crypto.js`) |
| **App setting** | `SESSION_SECRET` |
| **Purpose** | Used to derive the AES-256-GCM encryption key for session cookies. All session data (GitHub access token, user profile, cached Copilot token) is encrypted with this key. If this secret is compromised, an attacker can decrypt any session cookie. |
| **How to generate** | `openssl rand -base64 32` or any random string of at least 32 characters |
| **Note** | Required in production. In development (when `NODE_ENV` is unset or `"development"`), a hardcoded fallback is used with a warning. |

---

## Local Development (`.env`)

For local development with the Express server, the same OAuth credentials are
set in a `.env` file (see [`.env.example`](../.env.example)):

```env
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
SESSION_SECRET=a_random_secret_string_for_sessions
PORT=3000
```

The `.env` file is listed in `.gitignore` and must never be committed.

---

## Summary

| Secret | Where configured | Used for |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | GitHub Actions secrets | Azure OIDC login |
| `AZURE_TENANT_ID` | GitHub Actions secrets | Azure OIDC login |
| `AZURE_SUBSCRIPTION_ID` | GitHub Actions secrets | Azure OIDC login |
| `OAUTH_CLIENT_ID` | GitHub Actions secrets → SWA app settings | GitHub OAuth (login redirect) |
| `OAUTH_CLIENT_SECRET` | GitHub Actions secrets → SWA app settings | GitHub OAuth (token exchange) |
| `SESSION_SECRET` | GitHub Actions secrets → SWA app settings | Session cookie encryption |
