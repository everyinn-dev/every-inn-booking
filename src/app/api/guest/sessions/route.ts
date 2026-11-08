import { agent, BffError, fail, guard, ok, readJson } from "@/lib/server/bff";
import { criteriaStay, parseCriteria } from "@/lib/server/criteria";
import { storefront } from "@/lib/server/storefront";

export const dynamic = "force-dynamic";

/** POST /api/guest/sessions — "Giữ phòng 10 phút": the server re-derives the stay from the criteria. */
export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req, "HOLD_RL");
    requestId = g.requestId;
    const body = await readJson(req);
    const c = parseCriteria(body);
    const roomId = String(body.roomId ?? "");
    if (!/^[a-z]{3,9}-\d{3}$/.test(roomId)) throw new BffError(400, "VALIDATION_FAILED", "Chọn phòng.");
    const nonce = String(body.clientNonce ?? "");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) throw new BffError(400, "VALIDATION_FAILED", "Yêu cầu không hợp lệ.");
    const sf = (await storefront(g.env)).value;
    const stay = criteriaStay(c, sf, { early: Number(body.early ?? 0), late: Number(body.late ?? 0) });
    const r = await agent(g.env, req, "POST", "/internal/v1/web/sessions", {
      roomId,
      bookingType: stay.bookingType,
      checkinAt: stay.checkinAt,
      checkoutAt: stay.checkoutAt,
      earlyCheckinHours: stay.earlyCheckinHours,
      lateCheckoutHours: stay.lateCheckoutHours,
      numGuests: c.guests,
      ...(stay.shift ? { shift: stay.shift } : {}),
      clientNonce: nonce,
    });
    return ok(r.data, requestId, r.status);
  } catch (err) {
    return fail(err, requestId);
  }
}
