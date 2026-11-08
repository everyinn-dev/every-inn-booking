import { agent, BffError, fail, guard, ok, readJson, TOKEN_RE } from "@/lib/server/bff";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };
async function tokenOf(ctx: Ctx) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) throw new BffError(404, "SESSION_NOT_FOUND", "Phiên đặt phòng không tồn tại.");
  return token;
}

/** GET — current session (ETag passthrough → 304). */
export async function GET(req: Request, ctx: Ctx) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req);
    requestId = g.requestId;
    const r = await agent(g.env, req, "GET", `/internal/v1/web/sessions/${await tokenOf(ctx)}`);
    if (r.status === 304) return new Response(null, { status: 304, headers: { etag: r.etag ?? "", "Cache-Control": "private, no-store" } });
    return ok(r.data, requestId, 200, r.etag ? { etag: r.etag } : {});
  } catch (err) {
    return fail(err, requestId);
  }
}

/** PATCH — guest info (+ promotion code / voucher choice). */
export async function PATCH(req: Request, ctx: Ctx) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req);
    requestId = g.requestId;
    const b = await readJson(req);
    const guest = (b.guest ?? {}) as Record<string, unknown>;
    const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
    const r = await agent(g.env, req, "PATCH", `/internal/v1/web/sessions/${await tokenOf(ctx)}`, {
      guest: { name: str(guest.name, 120) ?? "", phone: str(guest.phone, 32), zalo: str(guest.zalo, 120), instagram: str(guest.instagram, 120), facebook: str(guest.facebook, 200), note: str(guest.note, 500) },
      ...(str(b.promotionCode, 40) ? { promotionCode: str(b.promotionCode, 40) } : {}),
      ...(str(b.voucherId, 80) ? { voucherId: str(b.voucherId, 80) } : {}),
      ...(b.noVoucher === true ? { noVoucher: true } : {}),
    });
    return ok(r.data, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}

/** DELETE — the guest cancels after the confirmation sheet; the room goes back on sale at once. */
export async function DELETE(req: Request, ctx: Ctx) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req);
    requestId = g.requestId;
    const r = await agent(g.env, req, "DELETE", `/internal/v1/web/sessions/${await tokenOf(ctx)}`);
    return ok(r.data, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}
