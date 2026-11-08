import { agent, BffError, fail, guard, ok, readJson, TOKEN_RE } from "@/lib/server/bff";

export const dynamic = "force-dynamic";

/** POST — "Tôi đã chuyển khoản": the quản lí gets a ping card; 5/min per session. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  let requestId = crypto.randomUUID();
  try {
    const { token } = await ctx.params;
    if (!TOKEN_RE.test(token)) throw new BffError(404, "SESSION_NOT_FOUND", "Phiên đặt phòng không tồn tại.");
    const g = await guard(req, "PAID_RL", `paid:${token.slice(0, 16)}`);
    requestId = g.requestId;
    const b = await readJson(req, 1024).catch(() => ({}) as Record<string, unknown>);
    const r = await agent(g.env, req, "POST", `/internal/v1/web/sessions/${token}/paid`, { ...(typeof b.note === "string" ? { note: b.note.slice(0, 200) } : {}) });
    return ok(r.data, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}
