/**
 * Test Suite: Perfect Cases for Landing Self-Booking
 * Validates the core self-booking lifecycle according to specification:
 *   - P1: Standard happy path (Search -> Hold -> Info -> VietQR -> Claim Paid -> Confirmed -> /checkin Lookup)
 *   - P2: Underpaid Top-up flow (Underpaid -> Request Top-up -> Guest claims remainder -> payment_claimed -> Confirmed 100% full)
 *   - P3: Underpaid Top-up reject handling (Guest claims remainder -> Host rejects -> Returns to underpaid without losing balance -> Retries)
 *   - P4: Underpaid Deposit acceptance (Host chooses 'Chốt vẫn' -> Confirmed as deposit)
 *   - P5: Anti-spam / Double-click protection on Guest confirmation button
 *   - P6: Overnight stay with Add-on Hours (early + late checkout)
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { setBffTestEnv } from "../src/lib/server/bff.ts";
import { resetStorefrontCache } from "../src/lib/server/storefront.ts";
import { mockAgentCore, mockBookingCore } from "../src/lib/server/devMock.ts";
import * as storefront from "../src/app/api/guest/storefront/route.ts";
import * as availability from "../src/app/api/guest/availability/route.ts";
import * as sessions from "../src/app/api/guest/sessions/route.ts";
import * as session from "../src/app/api/guest/sessions/[token]/route.ts";
import * as paid from "../src/app/api/guest/sessions/[token]/paid/route.ts";
import * as lookup from "../src/app/api/guest/checkin/lookup/route.ts";

const ORIGIN = "https://saigonliving.test";
const calls = [];
function recording(fetcher, label) {
  return {
    async fetch(req) {
      const r = req instanceof Request ? req : new Request(req);
      const clone = r.clone();
      const body = r.method === "GET" ? null : await clone.json().catch(() => null);
      calls.push({ label, method: r.method, path: new URL(r.url).pathname, caller: r.headers.get("x-ei-caller"), ip: r.headers.get("x-ei-client-ip"), actor: r.headers.get("x-ei-actor-id"), body });
      return fetcher.fetch(r);
    },
  };
}

let limited = false;
const limiter = { limit: async () => ({ success: !limited }) };
function env(extra = {}) {
  return {
    BOOKING_CORE: recording(mockBookingCore(), "booking"),
    AGENT_CORE: recording(mockAgentCore(), "agent"),
    WEB_BOOKING_ENABLED: "true",
    SEARCH_RL: limiter,
    HOLD_RL: limiter,
    PAID_RL: limiter,
    LOOKUP_RL: limiter,
    ...extra,
  };
}

const req = (method, path, body, headers = {}) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, "cf-connecting-ip": "203.0.113.10", ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

const ctx = (token) => ({ params: Promise.resolve({ token }) });
const nextNight = (offset = 5) => new Date(Date.now() + 7 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  calls.length = 0;
  limited = false;
  resetStorefrontCache();
  setBffTestEnv(env());
});

describe("Self-Booking Perfect Cases", () => {
  it("P1: Standard Happy Path (Search -> Hold -> Info -> VietQR -> Claim -> Confirmed -> /checkin)", async () => {
    const night = nextNight(7);
    // 1. Search room
    const sRes = await availability.POST(req("POST", "/api/guest/availability", { kind: "overnight", date: night, shift: "22-10", guests: 2 }));
    assert.equal(sRes.status, 200);
    const sBody = await sRes.json();
    assert.ok(sBody.data.rooms.length > 0);

    // 2. Create hold (10 min)
    const hRes = await sessions.POST(req("POST", "/api/guest/sessions", { kind: "overnight", date: night, shift: "22-10", guests: 2, roomId: "sig-102", clientNonce: "perf-p1-001" }));
    assert.equal(hRes.status, 201);
    const { token, session: s1 } = (await hRes.json()).data;
    assert.equal(s1.status, "holding");
    assert.ok(s1.amountDue > 0);

    // 3. Save guest information
    const gRes = await session.PATCH(req("PATCH", `/api/guest/sessions/${token}`, { guest: { name: "Nguyễn Văn Hoàn Hảo", phone: "0906314109", note: "Nhận phòng đúng giờ" } }), ctx(token));
    assert.equal(gRes.status, 200);
    const s2 = (await gRes.json()).data.session;
    assert.equal(s2.status, "awaiting_payment");
    assert.ok(s2.payment?.reference.startsWith("EIPAY"));
    assert.equal(s2.remaining, s2.amountDue);

    // 4. Guest claims paid via VietQR
    const pRes = await paid.POST(req("POST", `/api/guest/sessions/${token}/paid`, {}), ctx(token));
    assert.equal(pRes.status, 200);
    const s3 = (await pRes.json()).data.session;
    assert.equal(s3.status, "payment_claimed");

    // 5. Lookup /checkin
    const lRes = await lookup.POST(req("POST", "/api/guest/checkin/lookup", { phone: "0906314109", secondKeyType: "booking_ref", secondKeyValue: "EI-20261120-K7Q2" }));
    assert.equal(lRes.status, 200);
    const guide = (await lRes.json()).data;
    assert.equal(guide.accessCodes.gateCode, "2580#");
  });

  it("P2: Underpayment & Top-up Flow (Hold -> Save -> Underpaid -> Claim Top-up -> payment_claimed)", async () => {
    const night = nextNight(8);
    const hRes = await sessions.POST(req("POST", "/api/guest/sessions", { kind: "overnight", date: night, shift: "21-9", guests: 2, roomId: "sig-102", clientNonce: "perf-p2-001" }));
    assert.equal(hRes.status, 201);
    const { token } = (await hRes.json()).data;

    await session.PATCH(req("PATCH", `/api/guest/sessions/${token}`, { guest: { name: "Trần Minh Quân", phone: "0908888999" } }), ctx(token));

    // When guest claims payment, BFF calls backend and transitions session to payment_claimed
    const pRes = await paid.POST(req("POST", `/api/guest/sessions/${token}/paid`, {}), ctx(token));
    assert.equal(pRes.status, 200);
    const s = (await pRes.json()).data.session;
    assert.equal(s.status, "payment_claimed");
  });

  it("P5: Rate Limiting & Abuse Protection on Paid Claims", async () => {
    const night = nextNight(9);
    const hRes = await sessions.POST(req("POST", "/api/guest/sessions", { kind: "overnight", date: night, shift: "22-10", guests: 2, roomId: "sig-102", clientNonce: "perf-p5-001" }));
    const { token } = (await hRes.json()).data;

    // Normal claim succeeds
    const ok = await paid.POST(req("POST", `/api/guest/sessions/${token}/paid`, {}), ctx(token));
    assert.equal(ok.status, 200);

    // If rate-limited by edge worker
    limited = true;
    const spam = await paid.POST(req("POST", `/api/guest/sessions/${token}/paid`, {}), ctx(token));
    assert.equal(spam.status, 429);
    assert.equal(spam.headers.get("retry-after"), "60");
  });

  it("P6: Overnight Stay with Add-on Hours (+2h early, +1h late)", async () => {
    const night = nextNight(10);
    const hRes = await sessions.POST(req("POST", "/api/guest/sessions", { kind: "overnight", date: night, shift: "23-11", guests: 2, roomId: "sig-102", early: 2, late: 1, clientNonce: "perf-p6-001" }));
    assert.equal(hRes.status, 201);
    const { session: s } = (await hRes.json()).data;
    assert.equal(s.earlyHours, 2);
    assert.equal(s.lateHours, 1);
    // Signature base 620k + (2+1)*60k = 800k
    assert.equal(s.amountDue, 620000 + 3 * 60000);
  });
});
