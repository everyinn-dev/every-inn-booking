---
name: everyinn-core-endpoint
description: Add or change an HTTP route in an Every Inn Core Worker (everyinn-booking-core, everyinn-cdp-core, everyinn-agent-core) end to end — route table, per-route callers, handler, repo SQL, migration, OpenAPI contract, contract spec, tests, and consumer contract sync. Use whenever someone asks for a new Core API, a new field on a Core request/response, a new caller (e.g. agent-core) allowed on a route, or says "add endpoint", "expose X from booking core", "the admin needs an API for…", even if they don't say "contract".
---

# Every Inn — add or change a Core endpoint

The Cores are plain TypeScript Workers that only Service Bindings can reach. Their API contract is enforced in three places, and a route change has to keep all three in sync:
1. the router: `src/routes.ts`, dispatched by `src/index.ts`;
2. the OpenAPI file: `contracts/internal-v1.openapi.json`;
3. the parity test: `test/contract.spec.ts`.

Consumers (Admin, Landing, agent-core) keep byte-identical copies of the contract. If you skip a step, CI breaks in another repo. Read `everyinn-platform-docs/CONVENTIONS.md` §2–§3 first.

## Steps (booking-core paths; cdp-core and agent-core mirror them)

1. **Route.** Add `r("POST", \`${B}/things/:thingId/act\`, …)` to `ROUTES` in `src/routes.ts`.
   - A new path param needs a regex in `PARAM_PATTERNS`. The dispatcher validates it once, so no unbounded string ever reaches SQL.
   - Declare the allowed callers on the route. CDP already does this (`callers` + `assertCaller` in `src/index.ts`). Booking Core switches to the same pattern in task AI-1. The default is `["admin-bff"]`; open a route to `agent-core` only when the AI really needs it.
2. **Handler** in `src/handlers/<area>.ts`. Follow `createHold` in `src/handlers/holds.ts`:
   - `staffOf(ctx)` gives the actor;
   - `requireIdempotencyKey(request)` for every write;
   - `readJsonObject` plus the `require*`/`optional*` validators from `src/lib/http.ts` (with min/max bounds);
   - `expectedVersion(body)` from `handlers/common.ts` when mutating an existing aggregate;
   - hash the canonical input, then `idempotencyScope(op, ctx)` → `findReplay` → do the work → `claimIdempotency` **in the same batch**.
3. **SQL** in `src/repo/*.ts`.
   - Prepared statements only; name every column, never `SELECT *`.
   - Every `WHERE`/`ORDER BY` must use an index.
   - All writes go into one `tryBatch(db, stmts)` (`src/lib/command.ts`). It turns UNIQUE/CHECK fences into typed failures, and `commonFailure()` maps those to `ApiError`.
4. **Errors:** `throw new ApiError(status, "UPPER_SNAKE_CODE", "Vietnamese message", details?)`. Never put door codes, raw phones or secrets in `details` or logs (`src/lib/log.ts` redacts).
5. **Schema change?** Use the `everyinn-d1-migration` skill and keep it additive.
6. **Contract.** Add the operation to `contracts/internal-v1.openapi.json`:
   - `operationId`, request/response schemas, the `x-callers` array (identical to the route's callers), `x-idempotency: required` for writes, `x-required-role` when it applies.
   - Breaking change? Bump `CONTRACT_VERSION` in `src/routes.ts` and the contract `info.version` together.
7. **Tests** in `test/<area>.spec.ts`, using the `call()`/`command()` helpers in `test/helpers.ts`. `command` adds an idempotency key; `timeline(year)` gives each spec its own business days. Cover:
   - the happy path;
   - validation 422;
   - not-found 404;
   - conflict 409;
   - idempotent replay (same key returns the same body; a different body returns 409);
   - a forbidden caller (403 `FORBIDDEN_CALLER`).

   `test/contract.spec.ts` must still pass: routes, contract and the `x-callers` parity.
8. **Config guards.** Adding a new *caller* also requires:
   - updating the `ALLOWED_CALLERS` var in **both** `wrangler.jsonc` scopes;
   - updating the rule in `scripts/check-config.mjs`;
   - updating the `Caller` union in `src/lib/context.ts`;
   - regenerating types (`npm run cf-typegen`).
9. **Verify:** `npm run typecheck && npm test && npm run check:config && npm run build:dry-run:dev`.
10. **Sync consumers:** from `everyinn-platform-docs`, run `node scripts/sync-contracts.mjs`, then `--check`. Run the consumer tests (`everyinn-admin`: `npm test`). Add any new mapping to `MAPPINGS` in that script.
11. **Record it:** commit `feat(<scope>): … [TASK-ID]` on `feat/*` and open a PR to `dev`. Update the progress log and the status board (`everyinn-release-status` skill).

## Gotchas
- `x-ei-actor-id` must be digits and `x-ei-actor-role` must be `manager|receptionist`. Booking Core requires them even on GETs.
- Hold and booking `source` CHECK constraints only allow `admin|legacy_import`. Adding a value means rebuilding the table, so avoid it.
- The cron and the opportunistic outbox drain in `src/index.ts` must stay cheap; never add work per request to them.
