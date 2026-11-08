import { agent, fail, guard, ok } from "@/lib/server/bff";

export const dynamic = "force-dynamic";

/** GET /api/guest/pulse?v= — long-poll (≤ 25 s) on the availability version (InventoryPulse DO). */
export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req);
    requestId = g.requestId;
    const v = Math.max(0, Number(new URL(req.url).searchParams.get("v") ?? "0") || 0);
    const r = await agent<{ version: number; changed: boolean }>(g.env, req, "GET", `/internal/v1/web/pulse?v=${v}&timeout=25000`, undefined, { timeoutMs: 30_000 });
    return ok(r.data, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}
