import { agent, BffError, fail, guard, ok, TOKEN_RE } from "@/lib/server/bff";

export const dynamic = "force-dynamic";

/** GET ?v= — long-poll (≤ 25 s) through the session's Durable Object: 200 when it changed, 304 otherwise. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req);
    requestId = g.requestId;
    const { token } = await ctx.params;
    if (!TOKEN_RE.test(token)) throw new BffError(404, "SESSION_NOT_FOUND", "Phiên đặt phòng không tồn tại.");
    const v = Math.max(0, Number(new URL(req.url).searchParams.get("v") ?? "0") || 0);
    const r = await agent(g.env, req, "GET", `/internal/v1/web/sessions/${token}/live?v=${v}&timeout=25000`, undefined, { timeoutMs: 30_000 });
    if (r.status === 304) return new Response(null, { status: 304, headers: { "Cache-Control": "private, no-store" } });
    return ok(r.data, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}
