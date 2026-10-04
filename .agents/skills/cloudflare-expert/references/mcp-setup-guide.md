# Cloudflare MCP Architecture & Troubleshooting Guide

This guide details the complete Cloudflare Model Context Protocol (MCP) server ecosystem, authentication protocols, scope requirements, and troubleshooting solutions.

---

## 1. The 5 Official Cloudflare MCP Servers

Cloudflare provides 5 specialized remote MCP endpoints (`streamable-http` / SSE):

| MCP Server | Remote Endpoint | Auth Required | Purpose & Key Tools |
| :--- | :--- | :---: | :--- |
| **`cloudflare-docs`** | `https://docs.mcp.cloudflare.com/mcp` | **No** (Public) | Semantic AI Search over official documentation. Tools: `search_cloudflare_documentation`, `migrate_pages_to_workers_guide`. |
| **`cloudflare`** (Code Mode) | `https://mcp.cloudflare.com/mcp` | **Yes** (Bearer/OAuth) | Token-efficient full Cloudflare API access (172 products) in ~1k tokens. Tools: `docs`, `search` (OpenAPI specs), `execute` (runs JS API calls). |
| **`cloudflare-bindings`** | `https://bindings.mcp.cloudflare.com/mcp` | **Yes** (Bearer/OAuth) | Direct resource inspection & manipulation for Workers, KV (`kv_namespace_*`), D1 (`d1_database_*`), R2 (`r2_bucket_*`), Hyperdrive. |
| **`cloudflare-builds`** | `https://builds.mcp.cloudflare.com/mcp` | **Yes** (Bearer/OAuth) | CI/CD build inspection: `workers_builds_list_builds`, `workers_builds_get_build`, `workers_builds_get_build_logs`. |
| **`cloudflare-observability`** | `https://observability.mcp.cloudflare.com/mcp` | **Yes** (Bearer/OAuth) | Real-time structured log tailing, tracing, and metrics: `query_worker_observability`, `observability_keys`, `observability_values`. |

---

## 2. Authentication & Token Scope Troubleshooting

### Error 401 Unauthorized
- **Cause**: The client connected to a secure server (`cloudflare`, `bindings`, `builds`, `observability`) without an Authorization Bearer token or OAuth session.
- **Solution**: Provide an Authorization header (`"Authorization": "Bearer <TOKEN>"`) or complete the OAuth login flow.

### Error 403 Insufficient Scope (`insufficient_scope`)
```json
{"error":"insufficient_scope","error_description":"Token lacks required user:read or account:read scope"}
```
- **Root Cause & Common Trap**:
  - Creating a token inside **R2 Storage > Manage R2 API Tokens** creates an S3-compatible credentials pair (Access Key ID + Secret Key) with object read/write permissions only.
  - This token **lacks account-level discovery scopes** (`account:read` / `user:read`), causing the MCP server to reject the handshake with 403.
- **How to Create the Correct Token**:
  1. Navigate to **[dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)** (User Profile > API Tokens).
  2. Click **Create Token**.
  3. Option A (Quick): Choose template **"Edit Cloudflare Workers"** (includes Account Read, Workers Edit, D1 Edit).
  4. Option B (Custom Token):
     - **Account Permissions**:
       - `Account Settings` (or `Account Filter Lists`): **Read** *(generates mandatory `account:read` scope)*.
       - `Workers Scripts`: **Edit** (or Read).
       - `D1`: **Edit** (needed for `d1_database_*` tools).
       - `Workers R2 Storage`: **Edit** (needed for `r2_bucket_*` tools).
       - `Workers KV Storage`: **Edit** (needed for `kv_namespace_*` tools).
     - **Account Resources**: `Include` > `All accounts` (or select your account).

---

## 3. Configuration Standards Across Clients

### Antigravity IDE & Windsurf (`mcp_config.json`)
Located at `~/.gemini/config/mcp_config.json` (Machine-wide):
```json
{
  "mcpServers": {
    "cloudflare-docs": {
      "serverUrl": "https://docs.mcp.cloudflare.com/mcp"
    },
    "cloudflare": {
      "serverUrl": "https://mcp.cloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer <API_TOKEN>"
      }
    },
    "cloudflare-bindings": {
      "serverUrl": "https://bindings.mcp.cloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer <API_TOKEN>"
      }
    },
    "cloudflare-builds": {
      "serverUrl": "https://builds.mcp.cloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer <API_TOKEN>"
      }
    },
    "cloudflare-observability": {
      "serverUrl": "https://observability.mcp.cloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer <API_TOKEN>"
      }
    }
  }
}
```

### Cursor & VS Code (`.cursor/mcp.json` / `.mcp.json`)
```json
{
  "mcpServers": {
    "cloudflare-docs": {
      "type": "streamable-http",
      "url": "https://docs.mcp.cloudflare.com/mcp"
    },
    "cloudflare": {
      "type": "streamable-http",
      "url": "https://mcp.cloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer <API_TOKEN>"
      }
    },
    "cloudflare-bindings": {
      "type": "streamable-http",
      "url": "https://bindings.mcp.cloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer <API_TOKEN>"
      }
    },
    "cloudflare-builds": {
      "type": "streamable-http",
      "url": "https://builds.mcp.cloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer <API_TOKEN>"
      }
    },
    "cloudflare-observability": {
      "type": "streamable-http",
      "url": "https://observability.mcp.cloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer <API_TOKEN>"
      }
    }
  }
}
```

### Codex CLI
```bash
codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp
codex mcp add cloudflare-docs --url https://docs.mcp.cloudflare.com/mcp
codex mcp add cloudflare-bindings --url https://bindings.mcp.cloudflare.com/mcp
codex mcp add cloudflare-builds --url https://builds.mcp.cloudflare.com/mcp
codex mcp add cloudflare-observability --url https://observability.mcp.cloudflare.com/mcp
codex mcp login cloudflare
```

---

## 4. Git Hygiene & Security Protocol

- **Never commit real API tokens to git.**
- Ensure `.mcp.json` and `.agents/mcp_config.json` are added to `.gitignore`.
- If previously tracked, untrack with:
  ```bash
  git rm --cached .mcp.json .agents/mcp_config.json
  ```
- Always provide `.mcp.json.example` as a safe placeholder for other team members.
