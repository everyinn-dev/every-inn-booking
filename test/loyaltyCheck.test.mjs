import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST, GET, setTestEnv } from "../src/app/api/loyalty/check/route.ts";
import { FakeCdp } from "./helpers/fakeCdp.mjs";

beforeEach(() => {
  setTestEnv(null);
});

test("Landing loyalty check: GET returns 405 Method Not Allowed", async () => {
  const res = GET();
  assert.equal(res.status, 405);
  const data = await res.json();
  assert.equal(data.error, "method_not_allowed");
});

test("Landing loyalty check: cross-origin POST returns 403 Forbidden", async () => {
  const req = new Request("http://localhost:3000/api/loyalty/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil-site.com",
    },
    body: JSON.stringify({ phone: "0901234567" }),
  });
  const res = await POST(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error, "forbidden");
});

test("Landing loyalty check: invalid JSON body returns 400 invalid_request", async () => {
  const req = new Request("http://localhost:3000/api/loyalty/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: "not-json{",
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "invalid_request");
});

test("Landing loyalty check: invalid phone format or length returns 400 invalid_phone", async () => {
  for (const invalidPhone of ["123", "09012345678901234567890123456789012345", "0901abc456", "       "]) {
    const req = new Request("http://localhost:3000/api/loyalty/check", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ phone: invalidPhone }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400, `Expected 400 for phone: ${invalidPhone}`);
    const data = await res.json();
    assert.equal(data.error, "invalid_phone");
  }
});

test("Landing loyalty check: feature disabled returns 503", async () => {
  setTestEnv({ LOYALTY_ENABLED: "false" });
  const req = new Request("http://localhost:3000/api/loyalty/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({ phone: "0901234567" }),
  });
  const res = await POST(req);
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.error, "feature_disabled");
});

test("Landing loyalty check: missing CDP binding returns degraded 503", async () => {
  setTestEnv({ CDP_CORE: undefined });
  const req = new Request("http://localhost:3000/api/loyalty/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({ phone: "0901234567" }),
  });
  const res = await POST(req);
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.found, false);
  assert.equal(data.degraded, true);
  assert.equal(data.error, "unavailable");
});

test("Landing loyalty check: valid phone found returns 200 with masked profile", async () => {
  const fakeCdp = new FakeCdp(async (call) => {
    assert.equal(call.method, "POST");
    assert.equal(call.path, "/public-safe/v1/loyalty/lookup");
    assert.equal(call.headers["x-ei-caller"], "landing-bff");
    assert.equal(call.body.phone, "0901234567");

    return {
      status: 200,
      body: {
        found: true,
        phoneMasked: "09******67",
        tier: "bronze",
        lifetimeBookingCount: 3,
        nextTier: { code: "silver", remainingBookings: 2 },
        stamp: {
          status: "active",
          currentStep: 3,
          maxSteps: 10,
          startsAt: "2026-09-01T00:00:00Z",
          expiresAt: "2026-10-16T00:00:00Z",
          nextMilestoneStep: 8,
          milestones: [
            { step: 3, label: "Giảm 10%", status: "reached" },
            { step: 8, label: "Giảm 20%", status: "upcoming" },
          ],
        },
        rulesVersion: "mock-v1",
      },
    };
  });

  setTestEnv({ CDP_CORE: fakeCdp });

  const req = new Request("http://localhost:3000/api/loyalty/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({ phone: "0901234567" }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.found, true);
  assert.equal(data.tier, "bronze");
  assert.equal(data.phoneMasked, "09******67");
  assert.equal(data.stamp.currentStep, 3);
});

test("Landing loyalty check: valid phone not found returns 200 with found: false", async () => {
  const fakeCdp = new FakeCdp(async () => {
    return {
      status: 200,
      body: { found: false },
    };
  });

  setTestEnv({ CDP_CORE: fakeCdp });

  const req = new Request("http://localhost:3000/api/loyalty/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({ phone: "0999999999" }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.found, false);
});

test("Landing loyalty check: CDP error or timeout returns degraded 503", async () => {
  const fakeCdp = new FakeCdp(async () => {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  });

  setTestEnv({ CDP_CORE: fakeCdp });

  const req = new Request("http://localhost:3000/api/loyalty/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({ phone: "0901234567" }),
  });

  const res = await POST(req);
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.found, false);
  assert.equal(data.degraded, true);
  assert.equal(data.error, "unavailable");
});

test("Landing loyalty check: CDP rate limited returns 429", async () => {
  const fakeCdp = new FakeCdp(async () => {
    return new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 });
  });

  setTestEnv({ CDP_CORE: fakeCdp });

  const req = new Request("http://localhost:3000/api/loyalty/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({ phone: "0901234567" }),
  });

  const res = await POST(req);
  assert.equal(res.status, 429);
  const data = await res.json();
  assert.equal(data.error, "rate_limited");
});
