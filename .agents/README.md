# Every Inn Booking — Agent Index

This directory is the local index for AI guidance, MCP templates, and project conventions used by `every-inn-booking`.

## Start here
1. `AGENTS.md`
2. `.agents/README.md`
3. `.agents/rules/cloudflare-workers.md`
4. `.mcp.json.example`
5. Local-only `.mcp.json` / `.agents/mcp_config.json`

## Local agent files already in this repo
- `.agents/rules/cloudflare-workers.md` — Cloudflare Workers coding and runtime rules.
- `.agents/skills/cloudflare-expert/SKILL.md` — local Cloudflare architecture skill bundle.
- `.agents/skills/ui-ux/SKILL.md` — UI/UX design skill bundle.
- `.mcp.json.example` — portable MCP template for clients that read `.mcp.json`.
- `.mcp.json` — local gitignored MCP config for this checkout only.
- `.agents/mcp_config.json` — local gitignored MCP config for clients that expect `serverUrl` entries.

## Recommended MCP servers for this project
### Cloudflare
- `cloudflare-docs` — public Cloudflare documentation search.
- `cloudflare` — Cloudflare Code Mode / API access.
- `cloudflare-bindings` — bindings management.
- `cloudflare-builds` — build log inspection.
- `cloudflare-observability` — logs, metrics, and tracing.

### Project-adjacent tooling
- `cloudinary` — asset management for the `everyinn` Cloudinary account.
- `shadcn` — shadcn component MCP.
- `agentic-awesome-skills` — external skills catalog MCP.

## Cloudflare token security
For authenticated Cloudflare MCP servers, use a token created from **Cloudflare Dashboard → Profile → API Tokens → Edit Cloudflare Workers**.

Minimum scopes called out by the project brief:
- `Account: Workers Scripts (Edit)`
- `Account: D1 (Edit)`
- `Account Settings (Read)`

Rules:
- Never commit active bearer tokens.
- Keep real secrets only in local ignored files.
- If a token is rotated, update local ignored configs only.

## Project conventions to preserve
- Runtime stack: Next.js 16 App Router + React 19 + TypeScript + Cloudflare Workers via OpenNext.
- Prefer Cloudflare-native patterns and stateless Worker-safe code.
- UI direction: dark slate surfaces with amber brand accents.
- Use toast-based notifications instead of `window.alert()` / `window.confirm()`.
- Treat destructive SQL or production D1 migration commands as confirmation-required operations.
- Keep accessibility and performance in mind when editing customer-facing pages.

## Related machine-wide skills that fit this project
These are not checked into this repo, but they are relevant to this workspace if installed globally:
- `nextjs-on-cloudflare`
- `workers-best-practices`
- `wrangler`
- `durable-objects`
- `agents-sdk`
- `cloudflare-email-service`
- `turnstile-spin`
- `web-perf`

## Desired skill buckets from the project brief
The brief also calls out these domains as important conventions to preserve, even if they are not all checked into this repo as local skill folders yet:
- `cloudflare-expert`
- `ui-ux`
- `modern-web-guidance`
- `chrome-devtools`
- `a11y-debugging`
- `debug-optimize-lcp`
- `accidental-data-loss-prevention`

