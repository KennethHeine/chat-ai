# Copilot Instructions

> Repo-wide guidance for GitHub Copilot. See `AGENTS.md` for the full operating manual.

## Repo Structure

- `public/` — static frontend (vanilla HTML/CSS/JS)
- `server/` — Express 5 dev server (OAuth + session routes)
- `api/` — Azure Functions v4 backend (production auth endpoints)
- `infra/` — Azure Bicep IaC (do not modify without explicit request)
- `docs/` — project documentation

## Coding Conventions

- Plain JavaScript (no TypeScript, no transpilation)
- Node.js 22, Jest 30 for testing
- Separate `package.json` for root and `api/` — install deps in both
- Test files live next to their module with `.test.js` suffix
- Frontend tests use `@jest-environment jsdom` docblock pragma
- Mock external dependencies with `jest.mock()`
- Sanitize error responses: log details server-side, return generic messages to clients
- Rate-limit all auth/API endpoints using `api/src/utils/rate-limit.js`
- Security headers are configured in `public/staticwebapp.config.json` — update CSP if adding external resources
- Never commit secrets; use `.env` locally (see `.env.example`)

## Validation Checklist

Run before opening any PR:

```bash
npm test                          # server + frontend tests
cd api && npm test                # API tests
```

No linter or formatter is configured.

## Testing Expectations

- Add or update tests for every behavior change
- Server tests: `server/*.test.js`
- Frontend tests: `public/*.test.js`
- API tests: `api/src/**/*.test.js`
- If no tests are needed, state the reason explicitly
- See `docs/testing.md` for full details

## Documentation Expectations

- Update `README.md` when user-facing setup or usage changes
- Update files in `docs/` when auth flow, API spec, or secrets handling changes
- Authoritative docs: `README.md`, `docs/testing.md`, `docs/copilot-api-spec.md`, `docs/setup-and-integration.md`, `docs/secrets.md`

## Reference

`AGENTS.md` at the repo root is the primary operating manual for agents in this repo.
