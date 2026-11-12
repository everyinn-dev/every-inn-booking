---
name: everyinn-agent-core
description: Work on the Every Inn AI receptionist Worker `everyinn-agent-core` ("Home" — quiet hours, holds, owner payment confirmation, door-code vault, check-in delivery, RAG/FAQ, Telegram, Admin /agent-inbox & /agent-config backend). Use for any change to agent-core code, its agent-db schema, AdminApi routes, brain/tools/prompts, LLM model choice, Vectorize/AI Gateway usage, Telegram webhook, or when someone asks how the AI receptionist decides to hold, extend, confirm, send door codes or escalate — even if they just say "the bot", "AI lễ tân", "Home", "Telegram duyệt đơn" or "mã cửa".
---

# everyinn-agent-core — AI receptionist

The source of truth for decisions is `everyinn-platform-docs/EI_AI_RECEPTIONIST_IMPLEMENTATION_PLAN.md` §A, which holds owner decisions OD-1…OD-32 and the **Progress & Bug Log**. **How one chat turn works end to end** (pipeline order, guards, 16 tools, sales steps, router, kịch bản engine, master data, background flows, Telegram buttons, Admin map) is in `everyinn-platform-docs/EI_AI_RECEPTIONIST_ARCHITECTURE.md` — read it first and update it in the same commit when behaviour changes. The architecture rules are contract §27 and ADR-013..016. Read §A before changing behavior; several things in the original brief were wrong, such as wrangler limits, room ids, costs and the dark theme.

## Shape (ADR-014)
- **Default export, public `workers.dev`:** only `GET /health`, `/webhooks/meta` (verify token + signature) and `POST /webhooks/telegram`, which checks `X-Telegram-Bot-Api-Secret-Token` with `timingSafeEqual`. Everything else returns 404.
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

## Reply guard (model-independent, `src/brain/guard.ts` + `run.ts`)
LLM text is checked before any guest sees it: **G1** payment lines and unknown links are stripped (only the system payment block carries STK/QR/EIPAY). **G2** a hold claim with no real hold (checked per sentence; offers and questions are not claims). **G3** amounts not taken from a tool or an earlier verified message. **G4** a non-Vietnamese reply to a Vietnamese guest. **G5** a stall ("chờ em kiểm tra…") with no tool call. A violation triggers one corrective round:
- stall + the guest gave a date/time → only `check_availability`/`get_price_quote`, with `tool_choice: "required"`;
- claim + the guest gave a phone → only `create_booking_hold`, with `tool_choice: "required"`.

If the corrective round still fails, the reply is a safe fallback. A taken room gets a fallback naming Core's free alternatives. When the payment block is appended, the LLM's own money lines are dropped. Identical failing tool calls are not re-sent within a turn. Business rule enforced in the tools, not the prompt: a start at or after 22:00 is always overnight. Regression tests replay the real HITL-2 failures (BUG-20, BUG-23..29). Also **G6** "gọi quản lí" with no escalation, **G7** a rate-table dump (3+ prices with no availability/quote this turn), **G8** (in `brain/run.ts`, not `guard.ts`) S1/S4 reply that asks nothing while check-in/out or guests are unknown → owner `ask_slot` template appended. Reasoning output (`<thought>`) is stripped (BUG-50). Dev model: Gemma 4 26B (OD-22, about 50–80 neurons per LLM turn).

## Playbooks: guest stage × scenario (AI-7, OD-24..26, `src/brain/{stage,scenario,playbooks}.ts`)
- **Stage** (`loadGuestStage`, cached 10 min on `conversations.guest_stage*`): `in_stay` / `upcoming` (≤ 30 days) / `returning` / `new`, from this conversation's `checkin_schedules` then Booking Core by `linked_phone`.
- **Scenario** (`detectScenario`, deterministic, stored in `agent_tool_runs.scenario`): open incident / problem → S2c; extension while in the room → S2b; hold waiting or commit after a check → S3; booked guest question → S2a; concrete time or returning guest → S4; price/room ask without a slot → S1; info question → S2d; short follow-up keeps the previous scenario; else `unclear`.
- The prompt carries `CORE_RULES` + only the scenario's playbook (goal, steps) and offers only its tools (`scenarioTools`); photos and owner relays get every tool. Forced guard tools bypass the filter.
- Fixed sentences are owner templates (`message_templates`, `repo/templates.ts` `renderTemplate(key, values, lang)`; unknown `{placeholder}` refused on save). S1 first contact = `intro_new_guest` + room cards + chips "Theo giờ / Qua đêm / Theo ngày", 0 neurons.
- S3 commit (commit words + checked slot + phone known) forces `create_booking_hold` on the first round (BUG-48); the tool itself refuses without a commit (NEED_CONFIRM). Payment default = full; deposit only when check-in ≥ `depositMinLeadDays` (OD-25); a plea inside the window forces `request_deposit_exception` → 🙏 card `dx:<esc>:y|n` (BUG-51). Same room + slot again keeps the live hold (BUG-52).
- S2b `request_extension(hours)` (OD-26, `flows/extension.ts`): Booking Core `extend-quote` → ⏱️ card `ex:<ext>:y|n` or a reply with a price (`parseMoneyReply`) → `extend` with the approving staff actor (Core refuses the bot actor). `workflow_timers` (`flows/timers.ts`, 1-minute cron): T+3′ `extend_hold`, T+8′ reminder, T+11′ auto only with an `extend_auto` grant (`flows/grants.ts`, `/quyen`, acting as the granting manager), else `extend_wait` + reminders every 10′ ×3. Extra fee: `extend_payment` + QR, 💰 card `ep:<esc>:y|n` (money is recorded in Admin — agent-core has no finance access).
- **Master data (OD-27, `src/masterdata/`)**: scenarios, templates, rules, authority, segments are rows in `master_data` (registry.ts = schemas + `CAPABILITIES`; store.ts = cached reads, lazy seeds from defaults.ts, validation, system locks, `expectedVersion`). Never hard-code a business knob: add a registry field / capability / seed row. Brain: `playbookFor` + `matchScenarioRow` (owner scenarios by keywords), `rulesBlock`, `loadPersona` → segment, `flows/authority.ts` `decide()` (specific segment > any; never wins; limits; acts for the granting/last-approving manager), `logDecision` → `flows/learning.ts` digest. Admin API `/md/_registry`, `/md/:collection`, `/guests`, `/authority/decisions`.
- Escalation sub-kinds live in `owner_escalations.kind` (deposit_exception, extension_approval, extension_payment).

## Meta channel rules (AR-2, `src/webhooks/meta.ts`, `src/meta/api.ts`)
- Echo source by `classifyEcho`: metadata `ei:<msgId>` or own `app_id` → skip; Page inbox `263902037430900` → a person → HUMAN_TAKEOVER (OD-13); any other app → "🤖 App khác / Meta AI", never takes over. Keep `meta_outbound` as the fallback (IG echoes may lack `app_id`).
- Dev and prod are two Development-mode apps on the same Page (OD-14b). **The allowlist is the only lock on dev — never open it.**
- Send order (`buildMetaParts`): text → images → cards; with quick replies, images → cards → text + chips. Messenger groups images in one message (≤ 30); Instagram sends one by one.
- No Messenger Profile features (role-only in dev mode), no HUMAN_AGENT tag (needs App Review): after 24 h staff reply in the Meta app.
- Persona OD-17: say "quản lí" for escalation; never volunteer being automated, never deny it when sincerely asked. Reply in the guest's language (G4 both ways).
- Meta's 30 s rule: `TOOL_ROUND_BUDGET_MS` / `RETRY_BUDGET_MS` in `run.ts`. Deterministic routes (rooms, media, FAQ, greeting) never call the LLM.
- Token health: daily `debug_token` + code-190 alerts via `ops_alerts` (`EI_META_TOKEN_RUNBOOK.md`).

## Cost guards (Workers Free now — OD-7b)
- Free plan: no `limits` block (not allowed on Free); the Workers AI free tier is a hard cap of 10k neurons/day, so dev `dailyNeuronBudget` is 9000. Add `limits: { cpu_ms: 5000, subrequests: 150 }` back when upgrading to Paid (see `rules/cloudflare-free-tier.md` Paid addendum).
- Brain: ≤ 3 tool rounds and ≤ 8 tool calls per turn, last 10 messages, `max_tokens` 400, `reply_rate_limit_json` (6 replies per 5 min per conversation), and a daily neuron breaker over `agent_tool_runs.neurons_estimated` (index `idx_runs_created`) that switches to supervised mode and alerts Telegram.
- Exact FAQ matches and greetings skip the LLM entirely. RAG runs only for knowledge questions (`topK ≤ 4`).

## Working on it
- **Tests:** `npm test`. vitest-pool-workers runs with `remoteBindings: false`; secrets are injected in `vitest.config.ts`; Cores are mocked with `serviceBindings`. Call `admin()` for AdminApi and `publicCall()` for the public export (`test/helpers.ts`). Never call real AI or Vectorize from tests; use the `src/ai/*` adapters with fakes.
- **Schema:** `migrations/0001_agent_schema.sql`. Use the `everyinn-d1-migration` skill and prove indexes with `npm run db:migrate:local` plus `EXPLAIN QUERY PLAN`. The pending inbox filter uses `INDEXED BY idx_conv_pending_last_msg`.
- **Knowledge seed:** edit the canonical `everyinn-consultant` skill (docs repo) or `scripts/seed/*`, then run `npm run build:seed` and commit the generated `0002`. It is `INSERT OR IGNORE`, so staff edits in `/agent-config` survive.
- **Contracts:** after changing a route, update the contract, then run `node ../everyinn-platform-docs/scripts/sync-contracts.mjs` (Admin consumes `agent-core.openapi.json` from AI-4).
- **Record progress:** after each slice, update plan §A.4 and `EI_PHASE1_STATUS.md` §4.5 (`everyinn-release-status` skill).
