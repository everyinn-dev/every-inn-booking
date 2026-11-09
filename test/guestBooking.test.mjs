/**
 * LSB-3 — guest self-booking BFF routes (/api/guest/*) against contract-shaped fakes of Booking Core and
 * agent-core LandingApi (src/lib/server/devMock.ts): feature flag, same-origin, rate limit, stay normalisation
 * (incl. the 24h-12h shift starting 00:00 the next day), session lifecycle, long-poll 304, no-store, token checks.
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
import * as live from "../src/app/api/guest/sessions/[token]/live/route.ts";
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
  return { BOOKING_CORE: recording(mockBookingCore(), "booking"), AGENT_CORE: recording(mockAgentCore(), "agent"), WEB_BOOKING_ENABLED: "true", SEARCH_RL: limiter, HOLD_RL: limiter, PAID_RL: limiter, LOOKUP_RL: limiter, ...extra };
}
const req = (method, path, body, headers = {}) =>
  new Request(`${ORIGIN}${path}`, { method, headers: { origin: ORIGIN, "cf-connecting-ip": "203.0.113.9", ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
const ctx = (token) => ({ params: Promise.resolve({ token }) });
const nextNight = () => new Date(Date.now() + 7 * 3600_000 + 3 * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  calls.length = 0;
  limited = false;
  resetStorefrontCache();
  setBffTestEnv(env());
});

describe("guards", () => {
  it("feature flag off → 503 FEATURE_DISABLED on every guest route", async () => {
    setBffTestEnv(env({ WEB_BOOKING_ENABLED: "false" }));
    const res = await storefront.GET(req("GET", "/api/guest/storefront"));
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "FEATURE_DISABLED");
  });

  it("foreign origin on a write → 403; rate limit → 429 with Retry-After; always no-store", async () => {
    const bad = await availability.POST(req("POST", "/api/guest/availability", { kind: "overnight", date: nextNight(), guests: 2 }, { origin: "https://evil.example" }));
    assert.equal(bad.status, 403);
    limited = true;
    const slow = await availability.POST(req("POST", "/api/guest/availability", { kind: "overnight", date: nextNight(), guests: 2 }));
    assert.equal(slow.status, 429);
    assert.equal(slow.headers.get("retry-after"), "60");
    assert.match(slow.headers.get("cache-control"), /no-store/);
  });
});

describe("search", () => {
  it("normalises each shift to exact instants (24h-12h = 00:00 the day after the night date) and asks for add-ons", async () => {
    const night = nextNight();
    const res = await availability.POST(req("POST", "/api/guest/availability", { kind: "overnight", date: night, shift: "24-12", guests: 2 }));
    assert.equal(res.status, 200);
    const sent = calls.find((c) => c.path === "/internal/v1/availability/search").body;
    const nextDay = new Date(Date.parse(`${night}T00:00:00+07:00`) + 86_400_000 + 7 * 3600_000).toISOString().slice(0, 10);
    assert.equal(sent.checkinAt, new Date(`${nextDay}T00:00:00+07:00`).toISOString());
    assert.equal(sent.checkoutAt, new Date(`${nextDay}T12:00:00+07:00`).toISOString());
    assert.equal(sent.includeAddons, true);
    assert.equal(sent.applyPublicPromotions, true);
    const caller = calls.find((c) => c.label === "booking");
    assert.equal(caller.caller, "landing-bff");
    assert.equal(caller.actor, "900002");
    const body = await res.json();
    assert.equal(body.data.rooms.find((r) => r.room.id === "sig-202").available, false);
  });

  it("dayuse is 15:00 → 12:00; hourly needs a :00 start (:30 rejected); bad input → 400", async () => {
    const d = nextNight();
    const out = new Date(Date.parse(`${d}T00:00:00+07:00`) + 2 * 86_400_000 + 7 * 3600_000).toISOString().slice(0, 10);
    await availability.POST(req("POST", "/api/guest/availability", { kind: "dayuse", date: d, out, guests: 2 }));
    const sent = calls.find((c) => c.path === "/internal/v1/availability/search").body;
    assert.equal(sent.checkinAt, new Date(`${d}T15:00:00+07:00`).toISOString());
    assert.equal(sent.checkoutAt, new Date(`${out}T12:00:00+07:00`).toISOString());
    const badMinute = await availability.POST(req("POST", "/api/guest/availability", { kind: "hourly", date: d, start: "14:10", guests: 2 }));
    assert.equal(badMinute.status, 400);
    const badHalfHour = await availability.POST(req("POST", "/api/guest/availability", { kind: "hourly", date: d, start: "14:30", guests: 2 }));
    assert.equal(badHalfHour.status, 400);
    const goodHour = await availability.POST(req("POST", "/api/guest/availability", { kind: "hourly", date: d, start: "14:00", guests: 2 }));
    assert.equal(goodHour.status, 200);
  });
});

describe("session lifecycle", () => {
  it("hold (+1h early) → guest info → long-poll 304 while unchanged → paid → long-poll 200", async () => {
    const created = await sessions.POST(req("POST", "/api/guest/sessions", { kind: "overnight", date: nextNight(), shift: "22-10", guests: 2, roomId: "sig-102", early: 1, clientNonce: "test-nonce-0001" }));
    assert.equal(created.status, 201);
    const { data } = await created.json();
    const token = data.token;
    const hold = calls.find((c) => c.path === "/internal/v1/web/sessions");
    assert.equal(hold.body.earlyCheckinHours, 1);
    assert.equal(hold.body.shift, "22-10");
    assert.equal(hold.ip, "203.0.113.9");

    const saved = await session.PATCH(req("PATCH", `/api/guest/sessions/${token}`, { guest: { name: "Nguyễn Thị Phương Thảo", phone: "0906314109" } }), ctx(token));
    assert.equal((await saved.json()).data.session.status, "awaiting_payment");

    const v = (await (await session.GET(req("GET", `/api/guest/sessions/${token}`), ctx(token))).json()).data.session.version;
    const unchanged = await live.GET(req("GET", `/api/guest/sessions/${token}/live?v=${v}`), ctx(token));
    assert.equal(unchanged.status, 304);

    const p = await paid.POST(req("POST", `/api/guest/sessions/${token}/paid`, {}), ctx(token));
    assert.equal((await p.json()).data.session.status, "payment_claimed");
    const changed = await live.GET(req("GET", `/api/guest/sessions/${token}/live?v=${v}`), ctx(token));
    assert.equal(changed.status, 200);
  });

  it("a room taken in the meantime → 409 with the friendly Vietnamese message; malformed token → 404", async () => {
    const res = await sessions.POST(req("POST", "/api/guest/sessions", { kind: "overnight", date: nextNight(), shift: "22-10", guests: 2, roomId: "sig-202", clientNonce: "test-nonce-0002" }));
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.code, "AVAILABILITY_CHANGED");
    const nf = await session.GET(req("GET", "/api/guest/sessions/../../etc"), ctx("../../etc"));
    assert.equal(nf.status, 404);
  });
});

describe("/checkin lookup", () => {
  it("needs a valid second-key type; returns the guide with no-store", async () => {
    const bad = await lookup.POST(req("POST", "/api/guest/checkin/lookup", { phone: "0906314109", secondKeyType: "x" }));
    assert.equal(bad.status, 400);
    const ok = await lookup.POST(req("POST", "/api/guest/checkin/lookup", { phone: "0906314109", secondKeyType: "booking_ref", secondKeyValue: "EI-20261120-K7Q2" }));
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get("cache-control"), /no-store/);
    const body = (await ok.json()).data;
    assert.equal(body.accessCodes.gateCode, "2580#");
    assert.ok(body.guideBlocks.step3TaxiText.includes("71/31"));
  });
});
