import { bookingCore, fail, guard, ok, readJson } from "@/lib/server/bff";
import { criteriaStay, parseCriteria } from "@/lib/server/criteria";
import { storefront } from "@/lib/server/storefront";
import type { SearchResult } from "@/shared/booking-kit/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/guest/availability — every room for the criteria with the Core price (best public promotion), the
 * overnight add-on buttons and the "còn N phòng" per shift. Other guests' bookings are never exposed (Core).
 */
export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req, "SEARCH_RL");
    requestId = g.requestId;
    const body = await readJson(req);
    const c = parseCriteria(body);
    const sf = (await storefront(g.env)).value;
    const stay = criteriaStay(c, sf);
    const roomClass = body.roomClass === "haven" || body.roomClass === "signature" ? body.roomClass : undefined;
    const result = await bookingCore.post<SearchResult>(g.env, "/internal/v1/availability/search", {
      bookingType: stay.bookingType,
      checkinAt: stay.checkinAt,
      checkoutAt: stay.checkoutAt,
      earlyCheckinHours: 0,
      lateCheckoutHours: 0,
      numGuests: c.guests,
      applyPublicPromotions: true,
      ...(roomClass ? { roomClass } : {}),
      ...(stay.bookingType === "overnight" ? { includeAddons: true, includeShiftSummary: true } : {}),
    });
    return ok({ ...result, criteria: c, shift: stay.shift ?? null }, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}
