/** Validates guest search criteria from a request body (the server re-derives every instant — D1). */
import { toStay, type SearchCriteria, type Stay } from "@/shared/booking-kit/stay";
import type { Storefront } from "@/shared/booking-kit/types";
import { BffError } from "./bff";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[03]0$/;

export function parseCriteria(body: Record<string, unknown>): SearchCriteria {
  const kind = body.kind;
  if (kind !== "hourly" && kind !== "overnight" && kind !== "dayuse") throw new BffError(400, "VALIDATION_FAILED", "Chọn hình thức thuê: theo giờ, qua đêm hoặc theo ngày.");
  const date = String(body.date ?? "");
  if (!DATE.test(date)) throw new BffError(400, "VALIDATION_FAILED", "Ngày chưa hợp lệ.");
  const guests = Number(body.guests ?? 2);
  if (!Number.isInteger(guests) || guests < 1 || guests > 4) throw new BffError(400, "VALIDATION_FAILED", "Số khách từ 1 đến 4.");
  const c: SearchCriteria = { kind, date, guests };
  if (kind === "overnight") c.shift = typeof body.shift === "string" ? body.shift.slice(0, 8) : undefined;
  if (kind === "hourly") {
    if (!HHMM.test(String(body.start ?? ""))) throw new BffError(400, "VALIDATION_FAILED", "Chọn giờ nhận phòng.");
    c.start = String(body.start);
    const hours = Number(body.hours ?? 3);
    if (!Number.isInteger(hours) || hours < 3 || hours > 12) throw new BffError(400, "VALIDATION_FAILED", "Thời lượng từ 3 đến 12 giờ.");
    c.hours = hours;
  }
  if (kind === "dayuse") {
    const out = String(body.out ?? "");
    if (!DATE.test(out) || out <= date) throw new BffError(400, "VALIDATION_FAILED", "Ngày trả phòng phải sau ngày nhận phòng.");
    c.out = out;
  }
  return c;
}

export function criteriaStay(c: SearchCriteria, sf: Storefront, addons: { early?: number; late?: number } = {}): Stay {
  const early = c.kind === "overnight" ? Math.min(sf.overnight.max_addon_hours, Math.max(0, Number(addons.early ?? 0) || 0)) : 0;
  const late = c.kind === "overnight" ? Math.min(sf.overnight.max_addon_hours, Math.max(0, Number(addons.late ?? 0) || 0)) : 0;
  const stay = toStay(c, sf.overnight.shifts, { early, late }, sf.dayuse);
  if (!stay) throw new BffError(400, "VALIDATION_FAILED", "Thông tin lịch đặt chưa đủ.");
  return stay;
}
