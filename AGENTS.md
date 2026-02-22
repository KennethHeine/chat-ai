# AGENTS.md

> Operating manual for AI agents working in this repository.

## Project Snapshot

- **App**: Chat AI — a simple chat app with GitHub OAuth and the GitHub Copilot OpenAI-compatible API
- **Frontend**: Vanilla HTML/CSS/JS served as static files (`public/`)
- **Local dev server**: Express 5 (`server/`) — handles OAuth + session management
- **Production backend**: Azure Functions v4 (`api/`) — same auth endpoints, deployed to Azure Static Web Apps
- **Infrastructure**: Azure Bicep templates (`infra/`) — SWA, Storage, Key Vault
- **Runtime**: Node.js 22
- **Test framework**: Jest 30
- **Package manager**: npm (workspaces not used; root and `api/` have separate `package.json`)
- **Deployment**: Azure Static Web Apps via GitHub Actions (OIDC auth)
- **Session storage**: Azure Table Storage (Managed Identity in prod, Azurite for local dev)
- **Secrets**: Azure Key Vault (deployed separately via `deploy-keyvault.yml`)

## Golden Commands

### Install dependencies

```bash
npm install            # root (server + frontend)
cd api && npm install  # API (Azure Functions)
```

### Run locally (dev mode)

```bash
npm run dev   # Express server with --watch on port 3000
```

### Build

No build step — plain JS served directly.

### Test

```bash
npm test                          # server + frontend tests
cd api && npm test                # API tests
npm test && (cd api && npm test)  # all tests
```

### Lint / format / typecheck

No linter or formatter is configured in this repo. No TypeScript.

## Project Map

| Path | Purpose |
|------|---------|
| `public/` | Static frontend — `index.html`, `app.js`, `style.css`, SWA config |
| `server/` | Express dev server — `index.js` (entry), `auth.js` (OAuth routes) |
| `api/` | Azure Functions backend — auth endpoints in `src/functions/`, utilities in `src/utils/` |
| `api/src/functions/` | Azure Function handlers: `auth-github`, `auth-callback`, `auth-copilot-token`, `auth-me`, `auth-logout` |
| `api/src/utils/` | Shared utilities: `crypto.js`, `session.js`, `session-store.js`, `rate-limit.js` |
| `infra/` | Azure Bicep IaC — `main.bicep`, `keyvault.bicep`, `modules/` |
| `docs/` | Documentation — API spec, setup guide, auth flow, secrets, testing |
| `.github/workflows/` | CI/CD — `deploy-app.yml`, `deploy-infra.yml`, `deploy-keyvault.yml` |
| `.env.example` | Template for local environment variables |

### Do not touch

- `infra/` — infrastructure changes require Azure credentials and careful review
- `.github/workflows/deploy-*.yml` — deployment workflows use OIDC secrets; changes can break production

## Guardrails & Safety

- **Never commit secrets.** Use `.env` locally (already in `.gitignore`). See `.env.example` for the required variables.
- **Secret management**: OAuth secrets live in Azure Key Vault and are injected into SWA app settings via Bicep `getSecret()` at deploy time. Never hardcode them.
- **No destructive commands** (e.g., `rm -rf`, dropping tables) unless explicitly requested and confirmed.
- **Session security**: Sessions use opaque 256-bit IDs with server-side data in Azure Table Storage. AES-256-GCM encrypts session cookies. Do not expose token material in cookies.
- **CSP and security headers**: Configured in `public/staticwebapp.config.json`. Any new external resource must be added to the CSP.
- **Rate limiting**: All auth endpoints are rate-limited per-IP via `api/src/utils/rate-limit.js`. Maintain rate limits on new endpoints.
- **Error responses**: Sanitize errors — log raw details server-side, return generic messages to clients.

## Definition of Done

Before considering any code change complete:

1. **Tests**: Add or update tests for new/changed behavior. If no tests are needed, explicitly state why.
   - Place test files next to the module with a `.test.js` suffix
   - Frontend DOM tests use `@jest-environment jsdom` pragma
   - Use `jest.mock()` for external dependencies
2. **Docs**: Update relevant documentation (`README.md`, `docs/`) when behavior, configuration, or developer workflow changes.
3. **Validation**: Run all relevant checks:
   ```bash
   npm test && (cd api && npm test)
   ```
4. **PR hygiene**: Keep diffs small and focused. Include a clear summary, mention which commands were run and their results.
