---
name: everyinn-core-client
description: Call Every Inn Booking Core / CDP Core / Agent Core from a consumer Worker (everyinn-admin BFF routes, everyinn-agent-core tools, landing BFF) correctly — binding lookup, x-ei-* caller/actor headers, bot actor, Idempotency-Key, expectedVersion, retries, ETag/304, error mapping, and FakeCore tests. Use whenever code needs data from bookings, holds, availability, quotes, catalog, customers/loyalty or the AI receptionist, or someone writes `bookingCore.post`, `env.BOOKING_CORE.fetch`, or asks "why do I get 401 ACTOR_REQUIRED / 409 VERSION_CONFLICT".
---

# Every Inn — calling a Core from a consumer

Each Core is a separate Worker with its own D1, reachable only through a Service Binding. Consumers never run SQL against another service's data. They call `https://<core>-core.internal/internal/v1/...` through the binding. The Core trusts the caller and actor headers because no public route exists.

## Admin (Next.js BFF) — use `src/lib/cores.ts`

```ts
import { bookingCore, coreErrorResponse, newIdempotencyKey } from "@/lib/cores";
import { getCurrentStaff } from "@/lib/auth";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const headerKey = req.headers.get("idempotency-key")?.trim();
    const idempotencyKey = headerKey && IDEMPOTENCY_KEY_RE.test(headerKey) ? headerKey : newIdempotencyKey("hold-create");
    const res = await bookingCore.post<CoreHoldEnvelope>("/internal/v1/holds", { staff, idempotencyKey, body: { /* … */ } });
    return NextResponse.json({ success: true, ...res.data }, { status: res.status });
  } catch (err) {
    return coreErrorResponse(err); // or toHttpError(err) from "@/lib/apiError" for 5xx → 503 Vietnamese message
  }
}
```

The real example is `src/app/api/holds/route.ts`. The signature is `bookingCore.<verb><T>(path, { staff, body?, query?, idempotencyKey?, ifNoneMatch?, correlationId?, timeoutMs?, maxAttempts? })`. Pass a longer `timeoutMs` for slow calls such as an AI sandbox turn (about 25000).

- **What `cores.ts` does for you:**
  - binding lookup via `getCloudflareContext` (`CoreName` → `BINDING`; a missing binding gives `503 CORE_BINDING_MISSING`);
  - the `x-ei-caller: admin-bff`, actor and request-id headers;
  - retries (GETs and idempotent writes only: 3 attempts, 8 s timeout);
  - `If-None-Match`/304 passthrough;
  - typed `CoreError`.
- **Adding a Core** (e.g. `agent`): extend `CoreName` and `BINDING`, export a client object, and add the binding to **both** `wrangler.jsonc` scopes (`env.dev` doesn't inherit). Use `entrypoint: "AdminApi"` for agent-core.
- **Accept a client idempotency key** only if it matches `/^[A-Za-z0-9._:-]{8,128}$/`. Otherwise generate one per user action, never per retry.
- **Mutations:** send `expectedVersion` from the version you displayed. On `409 VERSION_CONFLICT`, call `toast.warning(...)`, refetch and let the user retry.

## Worker-to-Worker (agent-core and future Workers)

Build the same headers by hand in a small client (`src/clients/core.ts`):
- `x-ei-caller: agent-core`;
- the actor: **the bot** (`900001`, `receptionist`, `AI%20L%E1%BB%85%20T%C3%A2n`) for automatic actions, or the **approving human's staff id/role** (looked up from `telegram_staff_map_json` or the admin actor) for confirmations;
- `x-request-id` / `x-correlation-id`, where the correlation id is the conversation id;
- `idempotency-key`: deterministic for actions a person might tap twice (`agt.confirm.<holdId>`, `agt.extend.<holdId>.<expiresAtSec>`), random for one-off writes. All bot traffic shares one scope (`op:caller:actor`), so keys must be globally unique.
- A timeout per call (≤ 8 s) and **no retry on non-idempotent writes**.

## Errors you will meet

| Status / code | Meaning | Do |
|---|---|---|
| 401 `UNAUTHENTICATED_CALLER` | caller not in `ALLOWED_CALLERS` / known set | fix the Core config (see the `everyinn-core-endpoint` skill) |
| 401 `ACTOR_REQUIRED` | missing or invalid actor headers (Booking Core requires them on GETs too) | send digits plus `manager\|receptionist` |
| 403 `FORBIDDEN_CALLER` | route doesn't list your caller | open the route explicitly in the Core |
| 409 `VERSION_CONFLICT` / `IDEMPOTENCY_KEY_REUSED` / `ROOM_UNAVAILABLE` / `HOLD_EXPIRED` | concurrency or business conflict | refetch; tell the user; never auto-retry with a new key |
| 422 `*` | validation | show the Vietnamese message |
| 5xx / network | Core down | Admin maps these to 503 with a Vietnamese message; agent-core falls back to `ask_owner` |

## Testing (Admin)
- `test/helpers/fakeCore.mjs`: `new FakeCore("booking").on("POST", "/internal/v1/holds", (req) => ({ status: 201, body }))`.
- `setTestFetcher(core => fake)`, then assert on `fake.calls[0].headers.get("x-ei-caller")`, the body and the idempotency key, then `setTestFetcher(null)` in `finally`.
- Validate mapper input against the synced OpenAPI with `test/helpers/schemaValidator.mjs` (`test/contract.test.mjs`).
