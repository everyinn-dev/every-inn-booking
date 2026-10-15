import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

/** Same-origin only: the Origin (when sent) must match this request's host. */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients; CDP still validates input
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

/**
 * Landing BFF → CDP Core public-safe lookup (EI-OTA-ARCH-001 §Phase 1.4).
 * Returns only masked phone, tier and stamp progress. The raw phone is never logged or echoed.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);

  let phone = "";
  try {
    const body = (await req.json()) as { phone?: unknown };
    phone = typeof body.phone === "string" ? body.phone.trim() : "";
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (phone.length < 8 || phone.length > 32 || !/^[0-9+\s().-]+$/.test(phone)) {
    return json({ error: "invalid_phone" }, 400);
  }

  const { env } = await getCloudflareContext({ async: true });
  const loyaltyEnabled = (env as unknown as { LOYALTY_ENABLED?: string }).LOYALTY_ENABLED ?? (typeof process !== "undefined" ? process.env?.LOYALTY_ENABLED : undefined);
  if (loyaltyEnabled === "false") {
    return json({ error: "feature_disabled", message: "Chương trình tra cứu điểm đang được cập nhật." }, 503);
  }

  const cdp = (env as unknown as { CDP_CORE?: Fetcher }).CDP_CORE;
  if (!cdp) return json({ error: "unavailable" }, 503);

  try {
    const res = await cdp.fetch("https://cdp-core.internal/public-safe/v1/loyalty/lookup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-ei-caller": "landing-bff",
        "x-request-id": crypto.randomUUID(),
      },
      body: JSON.stringify({ phone }),
    });
    if (res.status === 400 || res.status === 422) return json({ error: "invalid_phone" }, 400);
    if (res.status === 429) return json({ error: "rate_limited" }, 429);
    if (!res.ok) return json({ error: "unavailable" }, 503);
    return json(await res.json());
  } catch {
    // Never include the phone or upstream details in logs/responses.
    console.error("loyalty lookup upstream failure");
    return json({ error: "unavailable" }, 503);
  }
}

export function GET() {
  return json({ error: "method_not_allowed" }, 405);
}

