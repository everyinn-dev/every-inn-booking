/**
 * booking-kit / format — SOURCE OF TRUTH: everyinn-platform-docs/shared/booking-kit/ (synced; edit here only).
 * Display helpers shared by the landing page and the admin wizard (Vietnamese, VN time).
 */

const VN = 7 * 3_600_000;
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN").replace(/,/g, ".")}đ`;
export const vndShort = (n: number) => (n % 1000 === 0 && n >= 1000 ? `${(n / 1000).toLocaleString("vi-VN")}k` : vnd(n));

function parts(iso: string) {
  const d = new Date(Date.parse(iso) + VN);
  return { hh: String(d.getUTCHours()).padStart(2, "0"), mm: String(d.getUTCMinutes()).padStart(2, "0"), dd: String(d.getUTCDate()).padStart(2, "0"), mo: String(d.getUTCMonth() + 1).padStart(2, "0"), wd: WEEKDAY[d.getUTCDay()]! };
}

/** "21:00" */
export const timeOf = (iso: string) => {
  const p = parts(iso);
  return `${p.hh}:${p.mm}`;
};
/** "T6, 20/11" */
export const dayOf = (iso: string) => {
  const p = parts(iso);
  return `${p.wd}, ${p.dd}/${p.mo}`;
};
/** "21:00 T6, 20/11" */
export const whenOf = (iso: string) => `${timeOf(iso)} ${dayOf(iso)}`;
/** Business date "2026-11-20" → "T6, 20/11" */
export const dateLabel = (date: string) => dayOf(`${date}T05:00:00.000Z`);

export const KIND_LABEL: Record<string, string> = { hourly: "Theo giờ", overnight: "Qua đêm", dayuse: "Theo ngày", custom: "Tuỳ chỉnh" };

/** "Qua đêm 22h–10h (+1h sớm)" */
export function stayLabel(s: { bookingType: string; shift?: string | null; earlyHours?: number; lateHours?: number; checkinAt: string; checkoutAt: string }): string {
  if (s.bookingType === "overnight") {
    const shift = s.shift ? ` ${s.shift.replace("-", "h–")}h` : "";
    const add = [s.earlyHours ? `+${s.earlyHours}h sớm` : "", s.lateHours ? `+${s.lateHours}h muộn` : ""].filter(Boolean).join(", ");
    return `Qua đêm${shift}${add ? ` (${add})` : ""}`;
  }
  if (s.bookingType === "hourly") return `Theo giờ · ${Math.round((Date.parse(s.checkoutAt) - Date.parse(s.checkinAt)) / 3_600_000)} giờ`;
  const nights = Math.max(1, Math.round((Date.parse(s.checkoutAt) - Date.parse(s.checkinAt)) / 86_400_000));
  return `Theo ngày · ${nights} đêm`;
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Friendly Vietnamese text for a Core / BFF error code (falls back to the server message). */
export function errorText(code: string | undefined, fallback: string): string {
  const map: Record<string, string> = {
    AVAILABILITY_CHANGED: "Rất tiếc, phòng này vừa có khách khác giữ. Bạn chọn phòng bên cạnh hoặc khung giờ khác nhé!",
    ROOM_UNAVAILABLE: "Rất tiếc, phòng này vừa có khách khác giữ. Bạn chọn phòng bên cạnh hoặc khung giờ khác nhé!",
    RATE_LIMIT_EXCEEDED: "Bạn thao tác hơi nhanh, chờ một chút rồi thử lại nhé.",
    TOO_MANY_HOLDS: "Bạn đang giữ phòng khác. Hoàn tất hoặc huỷ phòng đó trước nhé.",
    SESSION_NOT_FOUND: "Phiên đặt phòng không còn tồn tại.",
    NETWORK: "Mất kết nối, đang thử lại…",
  };
  return (code && map[code]) || fallback;
}
