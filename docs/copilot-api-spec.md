# GitHub Copilot API Specification

Complete API reference for the GitHub Copilot OpenAI-compatible API, including
authentication, token exchange, chat completions, and usage/quota endpoints.

---

## Authentication

### 1. GitHub OAuth — Device Flow

The device flow allows a CLI or application to authenticate without a browser
callback. It uses a public GitHub OAuth client.

#### OAuth Parameters

| Parameter              | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| Client ID              | `Iv1.b507a08c87ecfe98` (public Copilot OAuth app)      |
| Scope                  | `read:user`                                            |
| Device code endpoint   | `https://github.com/login/device/code`                 |
| Access token endpoint  | `https://github.com/login/oauth/access_token`          |
| Grant type             | `urn:ietf:params:oauth:grant-type:device_code`         |

> **Note:** For production web apps, register your own OAuth App at
> <https://github.com/settings/developers> and use the standard authorization
> code flow instead of the device flow.

#### Request a Device Code

```http
POST https://github.com/login/device/code
Content-Type: application/x-www-form-urlencoded
Accept: application/json

client_id=Iv1.b507a08c87ecfe98&scope=read:user
```

**Response:**

```json
{
  "device_code": "3584d83530557fdd1f46af8289938c8ef79f9dc5",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://github.com/login/device",
  "expires_in": 899,
  "interval": 5
}
```

#### Poll for the Access Token

Poll at `interval` seconds until the user authorizes or the code expires.

```http
POST https://github.com/login/oauth/access_token
Content-Type: application/x-www-form-urlencoded
Accept: application/json

client_id=Iv1.b507a08c87ecfe98&device_code=<device_code>&grant_type=urn:ietf:params:oauth:grant-type:device_code
```

| Response                                     | Action                  |
| -------------------------------------------- | ----------------------- |
| `{ "error": "authorization_pending" }`       | Keep polling            |
| `{ "error": "slow_down" }`                   | Increase interval +5 s  |
| `{ "error": "expired_token" }`               | Stop — code expired     |
| `{ "error": "access_denied" }`               | Stop — user denied      |
| `{ "access_token": "ghu_xxx", ... }`         | Success                 |

**Success response:**

```json
{
  "access_token": "ghu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "token_type": "bearer",
  "scope": "read:user"
}
```

### 2. GitHub OAuth — Authorization Code Flow (Web Apps)

For web applications with a server, use the standard authorization code flow:

```http
GET https://github.com/login/oauth/authorize?client_id=<CLIENT_ID>&scope=read:user
```

After the user authorizes, GitHub redirects to your callback URL with a `code`
parameter. Exchange it for an access token:

```http
POST https://github.com/login/oauth/access_token
Content-Type: application/json
Accept: application/json

{
  "client_id": "<CLIENT_ID>",
  "client_secret": "<CLIENT_SECRET>",
  "code": "<CODE>"
}
```

**Response:**

```json
{
  "access_token": "ghu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "token_type": "bearer",
  "scope": "read:user"
}
```

---

## Copilot Token Exchange

The GitHub access token cannot be used directly with the Copilot API. It must be
exchanged for a short-lived Copilot API token.

### Endpoint

```http
GET https://api.github.com/copilot_internal/v2/token
Authorization: Bearer <github_access_token>
Accept: application/json
```

### Response

```json
{
  "token": "tid=abc123;exp=1700000000;sku=free;proxy-ep=proxy.individual.githubcopilot.com;...",
  "expires_at": 1700000000
}
```

### Fields

| Field        | Type   | Description                                                    |
| ------------ | ------ | -------------------------------------------------------------- |
| `token`      | string | Semicolon-delimited key-value pairs; use as Bearer token       |
| `expires_at` | number | Unix timestamp (seconds). Values > 10 000 000 000 are ms.      |

### Deriving the API Base URL

Extract the `proxy-ep` field from the token string and replace the `proxy.`
prefix with `api.`:

```
Token:    "...proxy-ep=proxy.individual.githubcopilot.com;..."
Base URL: https://api.individual.githubcopilot.com
```

**Fallback:** `https://api.individual.githubcopilot.com`

### Caching

Cache the token and refresh it when fewer than 5 minutes remain before expiry:

```js
function isTokenUsable(cache) {
  return cache.expiresAt - Date.now() > 5 * 60 * 1000;
}
```

---

## Chat Completions

The Copilot API follows the OpenAI chat completions format. Use the **Copilot
token** (not the GitHub access token) as the Bearer token.

### Endpoint

```http
POST {baseUrl}/chat/completions
Authorization: Bearer <copilot_api_token>
Content-Type: application/json
```

### Request Body

```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello" }
  ],
  "max_tokens": 8192,
  "stream": false
}
```

### Request Parameters

| Parameter    | Type    | Required | Description                              |
| ------------ | ------- | -------- | ---------------------------------------- |
| `model`      | string  | Yes      | Model ID (see table below)               |
| `messages`   | array   | Yes      | Array of message objects                 |
| `max_tokens` | number  | No       | Maximum tokens in the response           |
| `stream`     | boolean | No       | `true` for SSE streaming                 |

### Message Object

| Field     | Type   | Required | Values                               |
| --------- | ------ | -------- | ------------------------------------ |
| `role`    | string | Yes      | `system`, `user`, `assistant`        |
| `content` | string | Yes      | Message text                         |

### Response (non-streaming)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

### Streaming Response

When `stream: true`, the API returns Server-Sent Events (SSE). Each event is a
JSON object prefixed with `data: `:

```
data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"!"}}]}

data: [DONE]
```

---

## Available Models

Model availability depends on the user's Copilot subscription plan.

| Model ID        | Context Window | Max Output Tokens | Input Types      |
| --------------- | -------------- | ----------------- | ---------------- |
| `gpt-4o`        | 128 000        | 8 192             | text, image      |
| `gpt-4.1`       | 128 000        | 8 192             | text, image      |
| `gpt-4.1-mini`  | 128 000        | 8 192             | text, image      |
| `gpt-4.1-nano`  | 128 000        | 8 192             | text, image      |
| `o1`            | 128 000        | 8 192             | text, image      |
| `o1-mini`       | 128 000        | 8 192             | text, image      |
| `o3-mini`       | 128 000        | 8 192             | text, image      |

Cost is zero — usage is covered by the Copilot subscription. If a model is not
available on the user's plan, the API returns an error.

---

## Quota and Usage

Check remaining Copilot quota with the internal user endpoint.

### Endpoint

```http
GET https://api.github.com/copilot_internal/user
Authorization: token <github_access_token>
Editor-Version: vscode/1.96.2
User-Agent: GitHubCopilotChat/0.26.7
X-Github-Api-Version: 2025-04-01
```

### Response

```json
{
  "copilot_plan": "individual",
  "quota_snapshots": {
    "premium_interactions": {
      "percent_remaining": 85.5
    },
    "chat": {
      "percent_remaining": 92.0
    }
  }
}
```

### Fields

| Field                                          | Type   | Description                      |
| ---------------------------------------------- | ------ | -------------------------------- |
| `copilot_plan`                                 | string | `individual`, `business`, `free` |
| `quota_snapshots.premium_interactions.percent_remaining` | number | Premium model quota (0–100)      |
| `quota_snapshots.chat.percent_remaining`        | number | Chat quota (0–100)               |

---

## Error Responses

All endpoints may return errors in this format:

```json
{
  "error": {
    "message": "Description of the error",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

Common HTTP status codes:

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| 400    | Bad request (invalid parameters)             |
| 401    | Invalid or expired token                     |
| 403    | Model not available on the user's plan        |
| 429    | Rate limited or quota exceeded               |
| 502    | Upstream API error                           |

---

## Environment Variables

For non-interactive environments, the GitHub access token can be provided via
environment variables (checked in order):

| Variable               | Description                          |
| ---------------------- | ------------------------------------ |
| `COPILOT_GITHUB_TOKEN` | Copilot-specific GitHub token        |
| `GH_TOKEN`             | GitHub CLI token                     |
| `GITHUB_TOKEN`         | Generic GitHub token                 |
