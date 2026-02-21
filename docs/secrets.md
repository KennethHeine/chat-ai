# Required Secrets

This document describes every secret used by the Chat AI application, where each
one is configured, and why it is needed.

---

## GitHub Actions Workflow Secrets

These secrets are configured in the repository under **Settings → Secrets and
variables → Actions**. They are used by the
[deploy workflows](../.github/workflows/) to authenticate with Azure and
populate Key Vault.

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
| **Purpose** | Identifies the Azure subscription where resources (resource group `rg-chat-ai`, Static Web App, Storage Account, Key Vault) are deployed. |
| **Where to find it** | Azure Portal → Subscriptions → **Subscription ID** |
| **Docs** | [Use GitHub Actions to connect to Azure](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure?tabs=azure-portal%2Clinux#use-the-azure-login-action-with-openid-connect) |

### `OAUTH_CLIENT_ID`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | Key Vault deploy workflow (`deploy-keyvault.yml`) |
| **Purpose** | Stored into Key Vault as the `GitHubClientId` secret. The main Bicep template reads it via `getSecret()` and injects it as the `GITHUB_CLIENT_ID` app setting on the Static Web App. |
| **Where to find it** | GitHub → Settings → Developer settings → OAuth Apps → your app → **Client ID** |
| **Docs** | [Creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) |

### `OAUTH_CLIENT_SECRET`

| | |
| ---------- | ------------------------------------------------------------ |
| **Used by** | Key Vault deploy workflow (`deploy-keyvault.yml`) |
| **Purpose** | Stored into Key Vault as the `GitHubClientSecret` secret. The main Bicep template reads it via `getSecret()` and injects it as the `GITHUB_CLIENT_SECRET` app setting on the Static Web App. |
| **Where to find it** | GitHub → Settings → Developer settings → OAuth Apps → your app → **Client secrets** → Generate a new client secret |
| **Docs** | [Creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) |

---

## Azure Key Vault

GitHub OAuth secrets (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) are stored in
Azure Key Vault and referenced at deployment time by the main Bicep template
using `getSecret()`. This keeps secrets out of workflow logs and centralizes
secret management in Azure.

| Key Vault secret       | Maps to SWA app setting  | Purpose |
| ---------------------- | ------------------------ | ------- |
| `GitHubClientId`       | `GITHUB_CLIENT_ID`       | GitHub OAuth login redirect + token exchange |
| `GitHubClientSecret`   | `GITHUB_CLIENT_SECRET`   | GitHub OAuth token exchange (server-side only) |

### Deployment order

1. **Deploy Key Vault first** — run the `Deploy Key Vault` workflow
   (`deploy-keyvault.yml`) via manual dispatch. This creates the Key Vault,
   assigns the deployer the **Key Vault Secrets Officer** role, and populates
   the two OAuth secrets from GitHub Actions secrets.
2. **Deploy main infrastructure** — run the `Deploy to Azure` workflow
   (`deploy.yml`). The Bicep template references the Key Vault via
   `getSecret()` and injects the secrets as SWA app settings along with
   `AZURE_STORAGE_ACCOUNT`.

### RBAC roles

| Role | Assigned to | Scope | Purpose |
| ---- | ----------- | ----- | ------- |
| Key Vault Secrets Officer | Deployer service principal | Key Vault | Write secrets during `deploy-keyvault.yml` |
| Key Vault Secrets User | SWA managed identity | Key Vault | Read secrets during ARM deployment (`getSecret()`) |
| Storage Table Data Contributor | SWA managed identity | Storage Account | Read/write session entities at runtime |

---

## App Settings (set by Bicep)

The following app settings are configured on the Static Web App automatically
by the `main.bicep` template — no manual `az staticwebapp appsettings set`
needed.

| App setting            | Source | Purpose |
| ---------------------- | ------ | ------- |
| `AZURE_STORAGE_ACCOUNT`| Bicep output (`storageAccount.name`) | Table Storage access via Managed Identity |
| `GITHUB_CLIENT_ID`     | Key Vault → `getSecret('GitHubClientId')` | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | Key Vault → `getSecret('GitHubClientSecret')` | GitHub OAuth |

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
| `OAUTH_CLIENT_ID` | GitHub Actions secrets → Key Vault | GitHub OAuth (stored as `GitHubClientId`) |
| `OAUTH_CLIENT_SECRET` | GitHub Actions secrets → Key Vault | GitHub OAuth (stored as `GitHubClientSecret`) |
| `AZURE_STORAGE_ACCOUNT` | Set by Bicep (auto) | Table Storage access via Managed Identity |
| `SESSION_SECRET` | `.env` (local dev only) | Express dev server sessions |
