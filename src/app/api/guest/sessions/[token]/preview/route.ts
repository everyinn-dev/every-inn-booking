import { agent, BffError, fail, guard, ok, readJson, TOKEN_RE } from "@/lib/server/bff";

export const dynamic = "force-dynamic";

/** POST — price preview while the guest types (tier, masked voucher wallet, promotion code check). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req, "SEARCH_RL");
    requestId = g.requestId;
    const { token } = await ctx.params;
    if (!TOKEN_RE.test(token)) throw new BffError(404, "SESSION_NOT_FOUND", "Phiên đặt phòng không tồn tại.");
    const b = await readJson(req, 2048);
    const s = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
    const r = await agent(g.env, req, "POST", `/internal/v1/web/sessions/${token}/preview`, {
      ...(s(b.phone, 32) ? { phone: s(b.phone, 32) } : {}),
      ...(s(b.promotionCode, 40) ? { promotionCode: s(b.promotionCode, 40) } : {}),
      ...(s(b.voucherId, 80) ? { voucherId: s(b.voucherId, 80) } : {}),
      ...(b.noVoucher === true ? { noVoucher: true } : {}),
    });
    return ok(r.data, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}
