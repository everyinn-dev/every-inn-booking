---
name: everyinn-agent-core
description: Work on the Every Inn AI receptionist Worker `everyinn-agent-core` ("Home" — quiet hours, holds, owner payment confirmation, door-code vault, check-in delivery, RAG/FAQ, Telegram, Admin /agent-inbox & /agent-config backend). Use for any change to agent-core code, its agent-db schema, AdminApi routes, brain/tools/prompts, LLM model choice, Vectorize/AI Gateway usage, Telegram webhook, or when someone asks how the AI receptionist decides to hold, extend, confirm, send door codes or escalate — even if they just say "the bot", "AI lễ tân", "Home", "Telegram duyệt đơn" or "mã cửa".
---

# everyinn-agent-core — AI receptionist

The source of truth for decisions is `everyinn-platform-docs/EI_AI_RECEPTIONIST_IMPLEMENTATION_PLAN.md` §A, which holds owner decisions OD-1..OD-8 and the **Progress & Bug Log**. The architecture rules are contract §27 and ADR-013..016. Read §A before changing behavior; several things in the original brief were wrong, such as wrangler limits, room ids, costs and the dark theme.

## Shape (ADR-014)
- **Default export, public `workers.dev`:** only `GET /health` and `POST /webhooks/telegram`, which checks `X-Telegram-Bot-Api-Secret-Token` with `timingSafeEqual`. Everything else returns 404.
- **`export class AdminApi extends WorkerEntrypoint`:** the staff API, reached only through Admin's binding `{ binding: "AGENT_CORE", service: "everyinn-agent-core(-dev)", entrypoint: "AdminApi" }`. It uses the Core header convention (`x-ei-caller: admin-bff` plus actor headers). Routes live in `src/admin/router.ts` and must match `contracts/agent-internal-v1.openapi.json` (`test/contract.spec.ts`).
- **Outbound:** `BOOKING_CORE` and `CDP_CORE`, caller `agent-core`. The bot actor is `900001`/`receptionist`. For confirmations, use the approving staff member's id.
- **Bindings:** `AGENT_DB` (D1), `AI` (Workers AI via AI Gateway `AI_GATEWAY_ID`), `RAG_INDEX` (Vectorize, bge-m3, 1024 dimensions). Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `DOOR_CODE_KEY`.

## Business rules you must keep (see `src/domain/*`)
| Rule | Where |
|---|---|
| The AI only **holds** a room: `POST /holds`, then `PATCH` the draft (name, phone, social handle or zalo, `closingNote "[AI] …"`, deposit 50%), optionally `/extend`. Confirmation (`/holds/:id/confirm`, deterministic key `agt.confirm.<holdId>`) happens only after the owner taps confirm. | brain tools (AI-3) |
| Quiet hours default to 01:30–07:15; manual busy comes from `busy_until`. `planHold()` extends to the busy end plus `holdBufferMinutes`, capped at check-in and at now + 12h. If check-in falls inside the busy window, the bot tells the guest to call the hotline. | `domain/quietHours.ts` |
| Door codes: a rotating **gate** code with validity windows, a fixed **lockbox** code per room, and an optional per-booking gate override. `resolveCodes()` returns metadata only; `revealForStay()` decrypts right before composing a message. Never log them. | `domain/doorCodes.ts`, `repo/doorCodes.ts` |
| OD-5: if check-in is ≤ 8h after confirmation, auto-send the guide; otherwise send a Telegram reminder to the owner at −6h. Missing code → `REQUEST_DOOR_CODE`. | `domain/checkinRule.ts` |
| Prices and availability come **only** from Booking Core quotes and availability. FAQs and RAG never contain prices or door codes (`scripts/build-seed.mjs` excludes FAQ 1, 2, 8 and 10 and refuses code-like strings). | seed + brain |
| Room ids are `haven-101, sig-102, haven-201, sig-202, haven-301, sig-302`. Haven max 2 guests, Signature max 4 (150k per extra guest, from the quote). | `domain/rooms.ts` |

## Cost guards (Workers Paid)
- `wrangler.jsonc` sets `limits: { cpu_ms: 5000, subrequests: 150 }` in both scopes; `scripts/check-config.mjs` enforces it.
- Brain: ≤ 3 tool rounds and ≤ 8 tool calls per turn, last 10 messages, `max_tokens` 400, `reply_rate_limit_json` (6 replies per 5 min per conversation), and a daily neuron breaker over `agent_tool_runs.neurons_estimated` (index `idx_runs_created`) that switches to supervised mode and alerts Telegram.
- Exact FAQ matches and greetings skip the LLM entirely. RAG runs only for knowledge questions (`topK ≤ 4`).

## Working on it
- **Tests:** `npm test`. vitest-pool-workers runs with `remoteBindings: false`; secrets are injected in `vitest.config.ts`; Cores are mocked with `serviceBindings`. Call `admin()` for AdminApi and `publicCall()` for the public export (`test/helpers.ts`). Never call real AI or Vectorize from tests; use the `src/ai/*` adapters with fakes.
- **Schema:** `migrations/0001_agent_schema.sql`. Use the `everyinn-d1-migration` skill and prove indexes with `npm run db:migrate:local` plus `EXPLAIN QUERY PLAN`. The pending inbox filter uses `INDEXED BY idx_conv_pending_last_msg`.
- **Knowledge seed:** edit the canonical `everyinn-consultant` skill (docs repo) or `scripts/seed/*`, then run `npm run build:seed` and commit the generated `0002`. It is `INSERT OR IGNORE`, so staff edits in `/agent-config` survive.
- **Contracts:** after changing a route, update the contract, then run `node ../everyinn-platform-docs/scripts/sync-contracts.mjs` (Admin consumes `agent-core.openapi.json` from AI-4).
- **Record progress:** after each slice, update plan §A.4 and `EI_PHASE1_STATUS.md` §4.5 (`everyinn-release-status` skill).
