# Chat AI — Project Goals

> A GitHub Copilot Chat clone for the web — users sign in with GitHub, use their own Copilot subscription, and can run agent tasks against repos they have access to. Everything possible runs in the browser using GitHub's APIs directly.

---

## Vision

Recreate the GitHub Copilot Chat experience (as seen on github.com) as an open, self-hosted web app. Users authenticate with GitHub, and the frontend talks directly to the Copilot API and GitHub REST/GraphQL APIs — the backend exists only for the OAuth handshake. Once the core chat works, build a reusable prompt & skill system that lets users compose and share custom agent tasks.

### Inspiration

The screenshot below shows the target UX — GitHub Copilot Chat on github.com with its model selector, agent/spark/git/PR action buttons, and multi-repo context:

![GitHub Copilot Chat](https://github.com/user-attachments/assets/copilot-chat-reference.png)

---

## Design Principles

| Principle | Detail |
|-----------|--------|
| **Frontend-first** | The browser does as much as possible — calls Copilot API, GitHub API, renders Markdown, manages conversations. The server is only for OAuth (client secret exchange). |
| **Use GitHub infrastructure** | Leverage GitHub APIs (repos, issues, PRs, actions, search, Copilot) instead of building backend services. GitHub is the database, the CI, and the AI provider. |
| **No build step** | Vanilla HTML/CSS/JS — no bundlers, no transpilation |
| **Zero cost** | All model usage covered by the user's Copilot subscription |
| **Security first** | Opaque sessions, HttpOnly cookies, CSP headers, rate limiting, no secrets in the client |

---

## Current State

| Area | Status | Notes |
|------|--------|-------|
| GitHub OAuth (authorization code flow) | ✅ Done | Server + Azure Functions |
| Copilot token exchange | ✅ Done | `GET /api/auth/copilot-token` → Copilot API token |
| Basic chat (non-streaming) | ✅ Done | Single model, plain text, no markdown |
| Session management | ✅ Done | Azure Table Storage (prod), in-memory (dev) |
| Rate limiting | ✅ Done | Per-IP on all auth endpoints |
| Azure deployment | ✅ Done | Static Web Apps + Functions |
| Tests | ✅ Done | Jest 30, server + frontend + API |

---

## Phase 1 — Core Chat Experience

*Get the chat working like GitHub Copilot Chat on github.com.*

### M1 — Streaming & Markdown

- [ ] SSE streaming (`stream: true` in request body), render tokens as they arrive
- [ ] Typing/loading indicator, "Stop generating" button
- [ ] Render assistant messages as Markdown (headings, lists, bold, links, tables)
- [ ] Syntax-highlighted code blocks with copy-to-clipboard
- [ ] Handle stream errors gracefully (network drop, 401/403 mid-stream, context overflow matching `/exceeds the limit of \d+/i`)

### M2 — Multi-Model & Copilot API Compliance

- [ ] **Dynamic base URL**: Derive the API base URL from the `proxy-ep` field in the Copilot token (replace `proxy.` prefix with `api.`). Fallback: `https://api.individual.githubcopilot.com`
- [ ] **Token caching**: Cache the Copilot API token and refresh before expiry (5-minute safety margin). Token comes from `GET /copilot_internal/v2/token` with the GitHub access token.
- [ ] Model selector dropdown (use [models.dev](https://models.dev) database or curated list); persist last-used in localStorage. Known models: `gpt-4o`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `o1`, `o1-mini`, `o3-mini`, plus GPT-5 family when available
- [ ] Required Copilot headers on every request: `Authorization: Bearer <copilot_token>`, `Openai-Intent: conversation-edits`, `x-initiator: user|agent`, `User-Agent: chat-ai/<version>`. Remove any `x-api-key` header.
- [ ] Multi-turn reasoning: parse `reasoning_text` / `reasoning_opaque` from responses, echo both in subsequent assistant messages for reasoning continuity
- [ ] Reasoning effort picker (`low` / `medium` / `high` / `xhigh`) for supported models. For Claude models via Copilot, use `thinking_budget` (e.g., `4000`) instead of `reasoning_effort`
- [ ] Vision support: image upload/paste → `image_url` parts (Chat Completions) or `input_image` parts (Responses API), set `Copilot-Vision-Request: true` header
- [ ] **Model routing**: GPT-5+ (non-mini) → Responses API (`/responses`), all others (GPT-4o, Claude, Gemini, o-series, GPT-5-mini) → Chat Completions API (`/chat/completions`)
- [ ] Prompt caching: attach `copilot_cache_control: { type: "ephemeral" }` as provider options on messages
- [ ] Handle 403 errors with reauthentication prompt

### M3 — Conversation Management

- [ ] Multiple chat threads stored in localStorage
- [ ] Sidebar to switch, rename, delete conversations; "New Chat" button
- [ ] System prompt configuration per conversation
- [ ] Quota display: call `GET https://api.github.com/copilot_internal/user` with headers `Authorization: token <github_access_token>`, `Editor-Version: vscode/1.96.2`, `User-Agent: GitHubCopilotChat/0.26.7`, `X-Github-Api-Version: 2025-04-01`. Response includes `copilot_plan` and `quota_snapshots` with `percent_remaining` per category (e.g., `premium_interactions`, `chat`)

---

## Phase 2 — GitHub Integration (Agent Actions)

*Let the chat interact with the user's GitHub repos — like Copilot Chat's agent mode on github.com.*

### M4 — Repository Context

- [ ] Repo picker: list the user's repos via GitHub REST API (`GET /user/repos`) — call from frontend with the GitHub OAuth token
- [ ] Read files from a repo (`GET /repos/{owner}/{repo}/contents/{path}`) and inject as context into the chat
- [ ] Branch selector for repo context
- [ ] Search code across repos (`GET /search/code`) from the frontend
- [ ] Show repo/file context chips in the chat input (like github.com's "All repositories" dropdown)

### M5 — Issue & PR Actions

- [ ] List issues / PRs for a repo from the frontend via GitHub API
- [ ] Create issues from the chat: user describes the issue → model generates title + body → user confirms → `POST /repos/{owner}/{repo}/issues`
- [ ] Create PRs: generate branch name, commit message, PR body → user confirms → push via GitHub API
- [ ] Comment on issues / PRs from the chat
- [ ] Assign Copilot to an issue (via `POST /repos/{owner}/{repo}/issues/{issue_number}/assignees` or the Copilot coding agent API when available)

### M6 — Agent Task Execution

- [ ] Define "agent tasks" — structured actions the model can suggest and the user can approve:
  - Create issue
  - Create PR
  - Create/update file in a repo
  - Trigger a GitHub Actions workflow
  - Search code
  - Read file contents
- [ ] Tool-use / function-calling pattern: model returns structured tool calls, frontend executes them against GitHub APIs after user confirmation
- [ ] Task status tracking: show pending / running / completed / failed states
- [ ] Action confirmation UI: show what the agent wants to do, let the user approve or edit before execution

---

## Phase 3 — Reusable Prompts & Skills

*Let users build, save, and share reusable prompt templates and skill chains for common agent workflows.*

### M7 — Prompt Library

- [ ] Prompt template system: save named prompts with variable placeholders (e.g., `{{repo}}`, `{{language}}`, `{{description}}`)
- [ ] Built-in starter prompts (e.g., "Create a bug report", "Review this PR", "Explain this code")
- [ ] Prompt editor UI: create, edit, delete, duplicate templates
- [ ] Store prompts in localStorage; export/import as JSON

### M8 — Skills (Composable Agent Workflows)

- [ ] Skill = a named sequence of prompts + tool calls that accomplish a goal
- [ ] Skill builder UI: chain together prompt steps, tool actions, and conditional logic
- [ ] Example skills:
  - **Bug Triage**: read issue → search related code → suggest fix → create branch + PR
  - **Code Review**: read PR diff → analyze → post review comments
  - **Release Notes**: list commits since last tag → generate release notes → create GitHub release
  - **Repo Setup**: create repo → add README, LICENSE, CI workflow → create initial issue
- [ ] Skills stored as JSON definitions in localStorage
- [ ] Share skills: export as JSON file or shareable URL/gist

### M9 — Skill Marketplace *(Stretch)*

- [ ] Public skill gallery: discover and import skills shared by others
- [ ] Skills stored as GitHub Gists or in a dedicated repo
- [ ] One-click import into local skill library
- [ ] Rating / popularity tracking

---

## Phase 4 — Polish & Power Features

### M10 — UX & Accessibility

- [ ] Responsive / mobile-friendly layout
- [ ] Dark mode / light mode toggle
- [ ] Keyboard shortcuts (Enter to send, Shift+Enter for newline, Escape to cancel)
- [ ] Auto-resize textarea
- [ ] Scroll-to-bottom button
- [ ] Message timestamps
- [ ] Accessibility (ARIA labels, keyboard navigation, screen reader support)

### M11 — Token Awareness & Context Management

- [ ] Track token usage per message (from API response `usage` field)
- [ ] Warn when approaching context window limits
- [ ] Auto-truncate or summarize older messages to stay within limits
- [ ] Display token count in the UI

### M12 — Export & Sharing

- [ ] Export a conversation as Markdown or JSON
- [ ] Import conversations from JSON
- [ ] Share a conversation via GitHub Gist

### M13 — Enterprise Support *(Stretch)*

- [ ] Configure a GitHub Enterprise domain (user provides `https://<enterprise-domain>`)
- [ ] Adjust OAuth URLs: device code → `https://<domain>/login/device/code`, access token → `https://<domain>/login/oauth/access_token`
- [ ] Adjust Copilot API base URL to `https://copilot-api.<domain>`
- [ ] Separate auth flow and credential storage for enterprise accounts (keyed as `github-copilot-enterprise`)

---

## Key API Surface (Frontend-Direct)

All of these are called from the browser — the backend is not involved.

**Base URL derivation**: The Copilot API base URL is dynamic — it comes from parsing the `proxy-ep` field in the Copilot token response (replace `proxy.` with `api.`). Default: `https://api.individual.githubcopilot.com`.

| API | Base URL | Auth | Purpose |
|-----|----------|------|---------|
| **Copilot Chat** | `{derivedBaseUrl}/chat/completions` | Copilot API token | Chat with models (most models) |
| **Copilot Responses** | `{derivedBaseUrl}/responses` | Copilot API token | GPT-5+ (non-mini) models |
| **Copilot Token Exchange** | `api.github.com/copilot_internal/v2/token` | GitHub access token | Get short-lived Copilot API token + base URL |
| **Copilot Quota** | `api.github.com/copilot_internal/user` | GitHub access token | Usage remaining (`percent_remaining`) |
| **GitHub REST** | `api.github.com` | GitHub access token | Repos, issues, PRs, files, actions, search |
| **GitHub GraphQL** | `api.github.com/graphql` | GitHub access token | Complex queries (PR reviews, commit history) |

### Required Copilot Headers

| Header | Value | Notes |
|--------|-------|-------|
| `Authorization` | `Bearer <copilot_api_token>` | The Copilot token from token exchange, NOT the GitHub access token |
| `User-Agent` | `chat-ai/<version>` | Client identification |
| `Openai-Intent` | `conversation-edits` | Required by the Copilot API |
| `x-initiator` | `user` or `agent` | `user` if last message is from user, `agent` otherwise |
| `Copilot-Vision-Request` | `true` | Only when request contains image content (`image_url` or `input_image` parts) |

**Important**: Remove any `x-api-key` header before sending requests to the Copilot API.

### Backend-Only Responsibilities

The server/Azure Functions handle only:

1. **OAuth token exchange** — requires `client_secret`, cannot be done in the browser
2. **Copilot token exchange** — `GET /copilot_internal/v2/token` proxied to keep GitHub access token server-side. Response contains a semicolon-delimited `token` string (parse `proxy-ep` for base URL) and `expires_at` (Unix timestamp). Cache with 5-min safety margin.
3. **Session management** — opaque session ID in cookie, session data in Azure Table Storage

---

## Out of Scope (for now)

- Server-side conversation storage (localStorage-first)
- Non-GitHub auth providers
- Self-hosted / non-Copilot LLMs
- Mobile native apps
- Real-time collaboration / multi-user chat
