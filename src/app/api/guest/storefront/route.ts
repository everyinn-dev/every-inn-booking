import { bookingCore, fail, guard, ok } from "@/lib/server/bff";

export const dynamic = "force-dynamic";

/** GET /api/guest/storefront — rooms, rates, shifts, booking window, public promotions (ETag → 304). */
export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req, "SEARCH_RL");
    requestId = g.requestId;
    const r = await bookingCore.get(g.env, "/internal/v1/storefront", req.headers.get("if-none-match"));
    if (r.status === 304) return new Response(null, { status: 304, headers: { etag: r.etag ?? "", "Cache-Control": "private, no-store" } });
    return ok(r.data, requestId, 200, r.etag ? { etag: r.etag } : {});
  } catch (err) {
    return fail(err, requestId);
  }
}
