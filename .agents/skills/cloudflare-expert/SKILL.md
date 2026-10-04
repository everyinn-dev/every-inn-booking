---
name: cloudflare-expert
description: All-in-one mastery of Cloudflare Workers, Durable Objects, WebSocket Hibernation, Agents SDK, KV, D1, R2, Queues, Workflows, Hyperdrive, Analytics Engine, Browser Rendering, wrangler.jsonc, and project rule configuration. Use when designing, building, configuring, or porting Cloudflare architecture to any project.
---

# Cloudflare Expert (All-In-One Unified Skill)

This skill consolidates complete, modern Cloudflare knowledge — including architecture patterns, coding standards, runtime rules, verified code recipes, and project installer scripts — into a single portable package.

---

## 1. Quick Navigation & References

| Reference Guide | Description |
| :--- | :--- |
| **[Core Rules & Standards](references/rules.md)** | TypeScript defaults, single-file preference, ES modules, secrets management, security, and error handling. |
| **[Verified Code Examples](references/code-examples.md)** | 10 complete, production-ready code examples with accompanying `wrangler.jsonc`. |
| **[Free Tier Guardrails](references/cloudflare-free-tier.md)** | Optimization rules, algorithmic constraints, and limits for Cloudflare Free Tier (Workers + D1). |
| **[MCP Architecture & Setup Guide](references/mcp-setup-guide.md)** | Complete guide to the 5 Cloudflare MCP servers, token scope troubleshooting (401/403), and git security. |
| **[AGENTS.md Template](resources/AGENTS.md.template)** | Ready-to-copy project instructions file for Antigravity, Cursor, Codex, and Claude Code. |
| **[wrangler.jsonc Template](resources/wrangler.jsonc.template)** | Standard base configuration with `compatibility_date`, `nodejs_compat`, and observability. |
| **[MCP Server Config Template](resources/mcp.json.template)** | Direct connection endpoints for Cloudflare Documentation & Code Mode MCP servers. |
| **[Project Installer Script](scripts/install-to-project.sh)** | 1-click script to install these rules, MCP configs, and skill into any project. |

---

## 2. Mandatory Configuration Standard (`wrangler.jsonc`)

Whenever configuring a new or existing Cloudflare Worker:
- **Always use `wrangler.jsonc`** (avoid `wrangler.toml`).
- **Compatibility**:
  - `compatibility_date`: `"2025-03-07"` (or current date for new workers)
  - `compatibility_flags`: `["nodejs_compat"]`
- **Observability**:
  ```jsonc
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  }
  ```
- **Bindings**: Bind only resources explicitly used in the worker. Do not include npm dependencies inside `wrangler.jsonc`.

---

## 3. WebSockets & Durable Objects Hibernation Rule

When writing WebSocket handling within Durable Objects:
1. **Always use the WebSocket Hibernation API**:
   - Call `this.ctx.acceptWebSocket(server)` (NEVER call `server.accept()`).
2. **Handlers to implement**:
   - `async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer)`
   - `async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean)`
   - `async webSocketError(ws: WebSocket, error: unknown)`
3. **DO NOT** use `server.addEventListener` inside Durable Objects.
4. Check [references/code-examples.md](references/code-examples.md) for the complete implementation.

---

## 4. Cloudflare Agents SDK Rules

When building AI Agents:
1. **Prefer `agents`**:
   - `import { Agent, ... } from 'agents';`
   - Extend `Agent<Env, State>` with typed interfaces.
2. **State & Database**:
   - Use `this.setState` for synchronized multi-client state.
   - Use `this.sql` for embedded SQLite database operations.
3. **Frontend Connection**:
   - Use `useAgent` hook from `agents/react`.
4. **Wrangler Migration**:
   - Must declare `"new_sqlite_classes": ["AgentClassName"]` under `migrations` in `wrangler.jsonc`.

---

---

## 5. Cloudflare MCP & Agent Tooling Ecosystem

Cloudflare provides 5 official remote MCP servers for AI agents:
1. **`cloudflare-docs`** (`https://docs.mcp.cloudflare.com/mcp`): Public, no auth required. AI search over all Cloudflare documentation.
2. **`cloudflare`** (`https://mcp.cloudflare.com/mcp`): Token-efficient Code Mode covering 172 Cloudflare products. Tools: `docs`, `search` (OpenAPI specs), `execute` (runs JS API calls).
3. **`cloudflare-bindings`** (`https://bindings.mcp.cloudflare.com/mcp`): Direct management of KV, D1, R2, Queues, Hyperdrive, and Workers scripts.
4. **`cloudflare-builds`** (`https://builds.mcp.cloudflare.com/mcp`): CI/CD inspection and build logs.
5. **`cloudflare-observability`** (`https://observability.mcp.cloudflare.com/mcp`): Structured real-time logging, metrics, and tracing.

### Critical Authentication & Security Rules
- **Error 403 `insufficient_scope`**: Never use R2-only storage tokens (`Manage R2 API Tokens`) for MCP servers — they lack `account:read` / `user:read`. Always create tokens from **[Profile API Tokens](https://dash.cloudflare.com/profile/api-tokens)** with template **"Edit Cloudflare Workers"** or custom token with `Account Settings: Read`.
- **Git Security**: Never commit `.mcp.json` or `.agents/mcp_config.json` with active tokens to git. Always add them to `.gitignore`, untrack with `git rm --cached`, and provide `.mcp.json.example`.
- See [references/mcp-setup-guide.md](references/mcp-setup-guide.md) for full endpoint specifications, client setup, and debugging.

---

## 6. Integrating Into Other Projects

To export and activate this complete Cloudflare knowledge into any other project:

### Method A: Run the Installer Script
From the terminal, run:
```bash
bash .agents/skills/cloudflare-expert/scripts/install-to-project.sh /path/to/target/project
```
This automatically:
- Creates `.agents/skills/cloudflare-expert` in the target project.
- Generates `AGENTS.md` and `.agents/rules/cloudflare-workers.md`.
- Generates `.mcp.json.example` and automatically protects credentials in `.gitignore`.

### Method B: Global Installation (Machine-Wide)
Because this skill is also installed at `~/.gemini/config/skills/cloudflare-expert`, the agent can activate it in **any** project on this machine without manual copying!

