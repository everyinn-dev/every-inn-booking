/**
 * booking-kit / stay — SOURCE OF TRUTH: everyinn-platform-docs/shared/booking-kit/ (synced byte-identical into
 * every-inn-booking and everyinn-admin by scripts/sync-booking-kit.mjs; edit here only).
 *
 * Search criteria ⇄ exact stay instants, the same way for the guest landing page and the admin wizard.
 * Business time is Asia/Ho_Chi_Minh (fixed UTC+7). Prices are NEVER computed here — Booking Core quotes them.
 */

export type StayKind = "hourly" | "overnight" | "dayuse";

export interface OvernightShift {
  code: string;
  start: string; // HH:MM ("00:00" = the morning after the night date)
  end: string; // HH:MM (morning after)
  label: string;
}

export interface SearchCriteria {
  kind: StayKind;
  /** hourly: the day · overnight: the NIGHT date (24h-12h starts 00:00 the day after) · dayuse: check-in day */
  date: string;
  shift?: string;
  start?: string; // hourly HH:MM
  hours?: number; // hourly duration
  out?: string; // dayuse check-out day
  guests: number;
}

export interface Stay {
  bookingType: StayKind;
  checkinAt: string; // UTC ISO
  checkoutAt: string;
  earlyCheckinHours: number;
  lateCheckoutHours: number;
  shift?: string;
}

const VN = 7 * 3_600_000;
const H = 3_600_000;

export const localMs = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+07:00`);
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00+07:00`) + n * 24 * H + VN).toISOString().slice(0, 10);
export const vnDate = (ms: number) => new Date(ms + VN).toISOString().slice(0, 10);
export const vnTime = (ms: number) => new Date(ms + VN).toISOString().slice(11, 16);
export const todayVn = (nowMs = Date.now()) => vnDate(nowMs);

/** Search criteria → the exact base stay (+ optional add-on hours for overnight). */
export function toStay(c: SearchCriteria, shifts: OvernightShift[], addons: { early?: number; late?: number } = {}, day = { checkin: "15:00", checkout: "12:00" }): Stay | null {
  if (c.kind === "hourly") {
    if (!c.start || !c.hours) return null;
    const inMs = localMs(c.date, c.start);
    return { bookingType: "hourly", checkinAt: new Date(inMs).toISOString(), checkoutAt: new Date(inMs + c.hours * H).toISOString(), earlyCheckinHours: 0, lateCheckoutHours: 0 };
  }
  if (c.kind === "dayuse") {
    const out = c.out && c.out > c.date ? c.out : addDays(c.date, 1);
    return { bookingType: "dayuse", checkinAt: new Date(localMs(c.date, day.checkin)).toISOString(), checkoutAt: new Date(localMs(out, day.checkout)).toISOString(), earlyCheckinHours: 0, lateCheckoutHours: 0 };
  }
  const sh = shifts.find((s) => s.code === c.shift) ?? shifts[1] ?? shifts[0];
  if (!sh) return null;
  const startsNextDay = Number(sh.start.slice(0, 2)) < 6;
  const inMs = localMs(startsNextDay ? addDays(c.date, 1) : c.date, sh.start);
  const outMs = localMs(addDays(c.date, 1), sh.end);
  const early = Math.max(0, addons.early ?? 0);
  const late = Math.max(0, addons.late ?? 0);
  return {
    bookingType: "overnight",
    checkinAt: new Date(inMs - early * H).toISOString(),
    checkoutAt: new Date(outMs + late * H).toISOString(),
    earlyCheckinHours: early,
    lateCheckoutHours: late,
    shift: sh.code,
  };
}

/** 00:00–04:59 local: "tonight" for an overnight search is still yesterday's night date (spec §3 edge 3). */
export function defaultNightDate(nowMs = Date.now()): string {
  const h = Number(vnTime(nowMs).slice(0, 2));
  return h < 5 ? addDays(vnDate(nowMs), -1) : vnDate(nowMs);
}
export const isSmallHours = (nowMs = Date.now()) => Number(vnTime(nowMs).slice(0, 2)) < 5;

/** Hourly start options (1-hour steps) between the first and last check-in, ≥ now + lead on today. */
export function hourlyStarts(date: string, first: string, last: string, leadMinutes: number, nowMs = Date.now()): string[] {
  const out: string[] = [];
  const from = localMs(date, first);
  const to = localMs(date, last);
  for (let t = from; t <= to; t += 60 * 60_000) if (t >= nowMs + leadMinutes * 60_000) out.push(vnTime(t));
  return out;
}

// ── URL ⇄ criteria (shareable search links: /dat-phong?loai=qua-dem&ngay=…&ca=22-10&khach=2) ──

const KIND_SLUG: Record<StayKind, string> = { hourly: "theo-gio", overnight: "qua-dem", dayuse: "theo-ngay" };

export function criteriaToQuery(c: SearchCriteria): string {
  const p = new URLSearchParams({ loai: KIND_SLUG[c.kind], ngay: c.date, khach: String(c.guests) });
  if (c.kind === "overnight" && c.shift) p.set("ca", c.shift);
  if (c.kind === "hourly") {
    if (c.start) p.set("gio", c.start);
    if (c.hours) p.set("so-gio", String(c.hours));
  }
  if (c.kind === "dayuse" && c.out) p.set("tra", c.out);
  return p.toString();
}

export function queryToCriteria(q: URLSearchParams, nowMs = Date.now()): SearchCriteria {
  const slug = q.get("loai");
  const kind: StayKind = slug === "theo-gio" ? "hourly" : slug === "theo-ngay" ? "dayuse" : "overnight";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("ngay") ?? "") ? q.get("ngay")! : kind === "overnight" ? defaultNightDate(nowMs) : vnDate(nowMs);
  const guests = Math.min(4, Math.max(1, Number(q.get("khach") ?? "2") || 2));
  return {
    kind,
    date,
    guests,
    shift: q.get("ca") ?? undefined,
    start: /^\d{2}:\d{2}$/.test(q.get("gio") ?? "") ? q.get("gio")! : undefined,
    hours: Math.min(12, Math.max(3, Number(q.get("so-gio") ?? "3") || 3)),
    out: /^\d{4}-\d{2}-\d{2}$/.test(q.get("tra") ?? "") ? q.get("tra")! : undefined,
  };
}
