import { agent, BffError, fail, guard, ok, readJson } from "@/lib/server/bff";

export const dynamic = "force-dynamic";

/**
 * POST /api/guest/checkin/lookup — phone + one second key → the 4-block check-in guide (codes only inside the
 * release window). 5/min/IP here + 5 failures / 15 min / IP in agent-core (D1). Never cached, never logged.
 */
export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const g = await guard(req, "LOOKUP_RL");
    requestId = g.requestId;
    const b = await readJson(req, 2048);
    const type = b.secondKeyType;
    if (type !== "booking_ref" && type !== "social" && type !== "checkin_date_room") throw new BffError(400, "VALIDATION_FAILED", "Chọn thông tin thứ 2 để xác thực.");
    const r = await agent(g.env, req, "POST", "/internal/v1/web/checkin/lookup", {
      phone: String(b.phone ?? "").slice(0, 32),
      secondKeyType: type,
      ...(typeof b.secondKeyValue === "string" ? { secondKeyValue: b.secondKeyValue.slice(0, 200) } : {}),
      ...(typeof b.checkinDate === "string" ? { checkinDate: b.checkinDate.slice(0, 10) } : {}),
      ...(typeof b.roomNumber === "string" ? { roomNumber: b.roomNumber.slice(0, 10) } : {}),
    });
    return ok(r.data, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}
