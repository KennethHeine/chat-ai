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
| **Purpose** | Identifies the Azure subscription where resources (resource group `rg-chat-ai`, Static Web App, Storage Account) are deployed. |
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

### `AZURE_STORAGE_ACCOUNT`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | Azure Functions (session store via `api/src/utils/session-store.js`) |
| **App setting** | `AZURE_STORAGE_ACCOUNT` |
| **Purpose** | The name of the Azure Storage Account that holds the `sessions` table. When set, the backend uses **Managed Identity** (no keys or connection strings) to access Table Storage. |
| **Where to find it** | Azure Portal → Storage accounts → your account → **Storage account name** |
| **Note** | The Static Web App's system-assigned Managed Identity must have the **Storage Table Data Contributor** role on this storage account. The Bicep template configures this automatically. |

---

## Session Management

> **No `SESSION_SECRET` required for Azure Functions.** The Azure Functions
> backend no longer encrypts session data into the cookie. Instead, it stores an
> opaque 256-bit session ID in the cookie and keeps all sensitive data (GitHub
> token, Copilot token, user profile) in Azure Table Storage. Access to Table
> Storage uses Managed Identity + RBAC — no storage keys or connection strings
> are needed in production.

The Express-based local development server (`server/index.js`) still uses
`express-session` with `SESSION_SECRET` for in-memory sessions.

---

## Local Development (`.env`)

For local development with the Express server, the OAuth credentials and session
secret are set in a `.env` file (see [`.env.example`](../.env.example)):

```env
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
PORT=3000

# Express dev server session secret (not used by Azure Functions)
SESSION_SECRET=a_random_secret_string_for_sessions

# Azure Table Storage for server-side sessions (Azure Functions)
# AZURE_STORAGE_ACCOUNT=your_storage_account_name          # Managed Identity
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true  # Azurite (local)
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
| `AZURE_STORAGE_ACCOUNT` | SWA app settings | Table Storage access via Managed Identity |
| `SESSION_SECRET` | `.env` (local dev only) | Express dev server sessions |
