/**
 * LSB-3 — in-memory stand-ins for BOOKING_CORE + AGENT_CORE (LandingApi), contract-shaped, for
 *  - `BOOKING_MOCK=1 next dev` (UI review / probe without the Workers), never in production;
 *  - the BFF route tests (test/guest*.test.mjs).
 * Times are real (VN), 6 rooms, overnight add-ons follow the shift matrix; room 202 is "Vừa được đặt".
 */
type J = Record<string, unknown>;
const H = 3_600_000;
const rooms = [
  { id: "sig-102", roomNumber: "102", name: "Signature 102", roomClass: "signature", floor: 1, areaSqm: 24, maxGuests: 4 },
  { id: "haven-101", roomNumber: "101", name: "Haven 101", roomClass: "haven", floor: 1, areaSqm: 16, maxGuests: 2 },
  { id: "sig-202", roomNumber: "202", name: "Signature 202", roomClass: "signature", floor: 2, areaSqm: 24, maxGuests: 4 },
  { id: "haven-201", roomNumber: "201", name: "Haven 201", roomClass: "haven", floor: 2, areaSqm: 16, maxGuests: 2 },
  { id: "sig-302", roomNumber: "302", name: "Signature 302", roomClass: "signature", floor: 3, areaSqm: 24, maxGuests: 4 },
  { id: "haven-301", roomNumber: "301", name: "Haven 301", roomClass: "haven", floor: 3, areaSqm: 16, maxGuests: 2 },
];
const base: Record<string, Record<string, number>> = { haven: { hourly: 320000, overnight: 520000, dayuse: 620000 }, signature: { hourly: 360000, overnight: 620000, dayuse: 750000 } };
const today = () => new Date(Date.now() + 7 * H).toISOString().slice(0, 10);
const plus = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00+07:00`) + n * 24 * H + 7 * H).toISOString().slice(0, 10);

export const storefrontDoc = () => ({
  catalogVersion: 3,
  property: { name: "Every Inn", address: "69/24L1 Nguyễn Công Hoan", hotline: "0906314109" },
  bank: { bankId: "MB", account: "0906314109999", holderName: "HO KINH DOANH EVERY INN" },
  rooms,
  rates: { haven: { combo3h: 320000, overnight: 520000, dayroom: 620000, extraHourFee: 60000 }, signature: { combo3h: 360000, overnight: 620000, dayroom: 750000, extraHourFee: 60000 } },
  extraGuest: { standardGuests: 2, feePerGuest: 150000, roomClasses: ["signature"] },
  hourly: { minHours: 3, firstCheckin: "08:00", lastCheckin: "21:00", slots: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] },
  overnight: {
    window_start: "21:00",
    window_end: "12:00",
    max_addon_hours: 3,
    shifts: [
      { code: "21-9", start: "21:00", end: "09:00", label: "21h – 9h" },
      { code: "22-10", start: "22:00", end: "10:00", label: "22h – 10h" },
      { code: "23-11", start: "23:00", end: "11:00", label: "23h – 11h" },
      { code: "24-12", start: "00:00", end: "12:00", label: "24h – 12h" },
    ],
  },
  dayuse: { checkin: "15:00", checkout: "12:00" },
  bookingWindow: { today: today(), maxAdvanceDays: 90, maxDate: plus(today(), 90), minLeadMinutes: 30 },
  publicPromotions: [{ id: "prm-weekday", name: "Ưu đãi ngày thường −10%", discountType: "percentage", discountValue: 10, description: null }],
});

const CAPS: Record<string, [number, number]> = { "21-9": [0, 3], "22-10": [1, 2], "23-11": [2, 1], "24-12": [3, 0] };
let version = 10;
const sessions = new Map<string, J & { version: number }>();
const byId = new Map<string, string>();

function search(b: J) {
  const type = String(b.bookingType);
  const ci = String(b.checkinAt);
  const co = String(b.checkoutAt);
  const hours = (Date.parse(co) - Date.parse(ci)) / H;
  const inLocal = new Date(Date.parse(ci) + 7 * H).toISOString().slice(11, 13);
  const shift = type === "overnight" ? ({ "21": "21-9", "22": "22-10", "23": "23-11", "00": "24-12" } as Record<string, string>)[inLocal] ?? "22-10" : null;
  return {
    searchedAt: new Date().toISOString(),
    bookingsVersion: version,
    checkinAt: ci,
    checkoutAt: co,
    bookingWindow: { maxAdvanceDays: 90, maxDate: plus(today(), 90) },
    ...(shift ? { shiftSummary: storefrontDoc().overnight.shifts.map((s) => ({ code: s.code, label: s.label, checkinAt: ci, checkoutAt: co, availableRooms: s.code === "21-9" ? 0 : 5, past: false })) } : {}),
    rooms: rooms.map((r) => {
      const busy = r.id === "sig-202" || Number(b.numGuests) > r.maxGuests || [...sessions.values()].some((s) => s.roomId === r.id && ["holding", "awaiting_payment", "payment_claimed"].includes(String(s.status)));
      const nights = type === "dayuse" ? Math.max(1, Math.round(hours / 24)) : 1;
      const p = base[r.roomClass]![type]! * nights + (type === "hourly" ? Math.max(0, hours - 3) * 60000 : 0) + (r.roomClass === "signature" && Number(b.numGuests) > 2 ? (Number(b.numGuests) - 2) * 150000 * nights : 0);
      const disc = Math.round(base[r.roomClass]![type]! * 0.1);
      const caps = shift ? CAPS[shift]! : [0, 0];
      const opt = (t: "early_checkin" | "late_checkout", n: number) =>
        Array.from({ length: n }, (_, i) => ({
          hours: i + 1,
          type: t,
          shortLabel: `+${i + 1}h ${t === "early_checkin" ? "nhận sớm" : "trả muộn"}`,
          label: `Thêm ${i + 1}h`,
          effectiveTimeIso: new Date(t === "early_checkin" ? Date.parse(ci) - (i + 1) * H : Date.parse(co) + (i + 1) * H).toISOString(),
          surchargeVnd: (i + 1) * 60000,
          available: !(r.id === "sig-102" && t === "late_checkout" && i >= 1),
          ...(r.id === "sig-102" && t === "late_checkout" && i >= 1 ? { unavailableReason: "TURNOVER_BUFFER_CONFLICT" } : {}),
        }));
      return {
        room: r,
        available: !busy,
        reasons: busy ? [{ code: Number(b.numGuests) > r.maxGuests ? "TOO_MANY_GUESTS" : "JUST_BOOKED", message: "Vừa được đặt" }] : [],
        conflicts: [],
        price: { ratePlanCode: type, comboLabel: type, durationLabel: "", basePrice: base[r.roomClass]![type]!, holidaySurcharge: 0, extraGuestFee: 0, extraFee: 0, subtotal: p, lines: [], cappingWarning: null, promotion: { id: "prm-weekday", code: null, name: "Ngày thường −10%", discount: disc }, total: p - disc },
        ...(shift ? { overnightAddons: { shift, maxEarlyAllowedByRule: caps[0], maxLateAllowedByRule: caps[1], surchargePerHour: 60000, earlyCheckinOptions: opt("early_checkin", caps[0]!), lateCheckoutOptions: opt("late_checkout", caps[1]!) } } : {}),
      };
    }),
  };
}

function view(s: J & { version: number }) {
  const due = Number(s.amountDue);
  const paid = Number(s.paidAmount ?? 0);
  return {
    ...s,
    serverNow: new Date().toISOString(),
    remainingSeconds: Math.max(0, Math.floor((Date.parse(String(s.expiresAt)) - Date.now()) / 1000)),
    remaining: Math.max(0, due - paid),
    payment: s.status !== "holding" && due - paid > 0 ? { bankId: "MB", account: "0906314109999", holderName: "HO KINH DOANH EVERY INN", amount: due - paid, reference: s.reference, qrUrl: `https://img.vietqr.io/image/MB-0906314109999-compact2.png?amount=${due - paid}&addInfo=${s.reference}` } : null,
    can: { editGuest: ["holding", "awaiting_payment"].includes(String(s.status)), claimPaid: ["awaiting_payment", "payment_claimed", "underpaid", "expired"].includes(String(s.status)), cancel: ["holding", "awaiting_payment"].includes(String(s.status)) },
  };
}

function bump(s: J & { version: number }, patch: J, event?: string, label?: string) {
  Object.assign(s, patch);
  s.version += 1;
  version += 1;
  if (event) (s.timeline as J[]).push({ event, label, at: new Date().toISOString() });
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const err = (status: number, code: string, message: string) => json({ error: { code, message, request_id: "mock" } }, status);

export function mockBookingCore(): Fetcher {
  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      const req = input instanceof Request ? input : new Request(input, init);
      const u = new URL(req.url);
      if (req.headers.get("x-ei-caller") !== "landing-bff") return err(401, "UNAUTHENTICATED_CALLER", "caller");
      if (u.pathname === "/internal/v1/storefront") return json(storefrontDoc(), 200, { etag: 'W/"sf-3"' });
      if (u.pathname === "/internal/v1/availability/search") {
        const b = (await req.json()) as J;
        if (String(b.checkinAt) > `${plus(today(), 91)}T00:00:00Z`) return err(422, "ADVANCE_BOOKING_EXCEEDED", "Home hiện chỉ nhận đặt phòng trước tối đa 90 ngày.");
        return json(search(b));
      }
      return err(404, "ROUTE_NOT_FOUND", u.pathname);
    },
  } as unknown as Fetcher;
}

export function mockAgentCore(): Fetcher {
  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      const req = input instanceof Request ? input : new Request(input, init);
      const u = new URL(req.url);
      const m = req.method;
      if (req.headers.get("x-ei-caller") !== "landing-bff") return err(401, "UNAUTHENTICATED_CALLER", "caller");
      const B = "/internal/v1/web";
      if (u.pathname === `${B}/pulse`) return json({ version, changed: Number(u.searchParams.get("v") ?? 0) < version });
      if (u.pathname === `${B}/sessions` && m === "POST") {
        const b = (await req.json()) as J;
        if (b.roomId === "sig-202") return err(409, "AVAILABILITY_CHANGED", "Phòng vừa có khách khác giữ.");
        const token = `tok${crypto.randomUUID().replace(/-/g, "")}${"x".repeat(8)}`;
        const r = rooms.find((x) => x.id === b.roomId)!;
        const amount = base[r.roomClass]![String(b.bookingType)]! + (Number(b.earlyCheckinHours ?? 0) + Number(b.lateCheckoutHours ?? 0)) * 60000;
        const s = {
          ref: `ses_${token.slice(3, 19)}`,
          channel: "web",
          status: "holding",
          statusLabel: "Đang giữ phòng cho bạn",
          roomId: r.id,
          room: { id: r.id, label: r.name },
          bookingType: b.bookingType,
          shift: b.shift ?? null,
          checkinAt: b.checkinAt,
          checkoutAt: b.checkoutAt,
          earlyHours: b.earlyCheckinHours ?? 0,
          lateHours: b.lateCheckoutHours ?? 0,
          numGuests: b.numGuests,
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          amountDue: amount,
          paidAmount: 0,
          reference: `EIPAY${today().replace(/-/g, "").slice(2)}W9X4`,
          pricing: { basePrice: amount, subtotal: amount, promotion: null, voucher: null, total: amount, payable: amount, isDeposit: false },
          guest: null,
          bookingId: null,
          timeline: [{ event: "HOLD_CREATED", label: "Đã giữ phòng cho bạn", at: new Date().toISOString() }],
          version: 1,
        };
        sessions.set(token, s);
        byId.set(s.ref, token);
        version += 1;
        return json({ token, replayed: false, session: view(s) }, 201);
      }
      const sm = new RegExp(`^${B}/sessions/([^/]+)(?:/(live|preview|paid))?$`).exec(u.pathname);
      if (sm) {
        const s = sessions.get(sm[1]!);
        if (!s) return err(404, "SESSION_NOT_FOUND", "Phiên đặt phòng không tồn tại hoặc đường dẫn đã cũ.");
        const act = sm[2];
        if (!act && m === "GET") return json({ session: view(s) }, 200, { etag: `W/"ses-${s.version}"` });
        if (act === "live") {
          const v = Number(u.searchParams.get("v") ?? 0);
          if (s.version > v) return json({ session: view(s) });
          return new Response(null, { status: 304 });
        }
        if (act === "preview") {
          const b = (await req.json()) as J;
          const member = typeof b.phone === "string" && b.phone.endsWith("9");
          const vouchers = member ? [{ id: "vch_1", codeMasked: "TEM3-••Q2", value: 50000, label: "Voucher tem mốc 3", expiresAt: new Date(Date.now() + 30 * 24 * H).toISOString() }] : [];
          const v = b.noVoucher ? null : vouchers[0] ? { id: "vch_1", codeMasked: "TEM3-••Q2", label: "Voucher tem mốc 3", discount: 50000 } : null;
          const promo = b.promotionCode === "BANBE100K" ? { name: "Ưu đãi Bạn Bè", eligible: true, reason: null, discount: 100000 } : b.promotionCode ? { name: null, eligible: false, reason: "Mã ưu đãi không tồn tại hoặc không hợp lệ.", discount: 0 } : null;
          const total = Number(s.amountDue) - (promo?.eligible ? promo.discount : 0) - (v?.discount ?? 0);
          return json({ pricing: { basePrice: s.amountDue, surcharges: 0, lines: [], subtotal: s.amountDue, promotion: promo, voucher: v, total }, member: b.phone ? { tier: member ? "silver" : "not_member", found: member } : null, vouchers });
        }
        if (act === "paid") {
          if (s.status === "expired") bump(s, { status: "late_payment", statusLabel: "Home đang kiểm tra lại phòng cho bạn" }, "LATE_CLAIM", "Bạn báo đã chuyển khoản");
          else bump(s, { status: "payment_claimed", statusLabel: "Home đang đối soát chuyển khoản", expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }, "GUEST_CLAIMED_PAID", "Bạn báo đã chuyển khoản");
          // dev preview: the "quản lí" confirms 6 s later so the realtime flip is visible
          setTimeout(() => bump(s, { status: "confirmed", statusLabel: "Đặt phòng thành công", paidAmount: s.amountDue, bookingId: `EI-${today().replace(/-/g, "")}-K7Q2` }, "CONFIRM_SUCCEEDED", "Đặt phòng thành công"), 6000);
          return json({ session: view(s) });
        }
        if (!act && m === "PATCH") {
          const b = (await req.json()) as J;
          const g = b.guest as J;
          if (!g?.phone) return err(422, "PHONE_REQUIRED", "Vui lòng nhập số điện thoại.");
          const disc = (b.promotionCode === "BANBE100K" ? 100000 : 0) + (b.voucherId ? 50000 : 0);
          bump(
            s,
            {
              status: "awaiting_payment",
              statusLabel: "Chờ thanh toán",
              amountDue: Number(s.pricing && (s.pricing as J).subtotal) - disc,
              guest: { name: g.name, phoneMasked: `${String(g.phone).slice(0, 3)}****${String(g.phone).slice(-3)}`, instagram: g.instagram ?? null, facebook: g.facebook ?? null, note: g.note ?? null },
              pricing: { ...(s.pricing as J), promotion: b.promotionCode === "BANBE100K" ? { name: "Ưu đãi Bạn Bè", discount: 100000 } : null, voucher: b.voucherId ? { codeMasked: "TEM3-••Q2", label: "Voucher tem mốc 3", discount: 50000 } : null, total: Number((s.pricing as J).subtotal) - disc },
            },
            s.status === "holding" ? "GUEST_SAVED" : undefined,
            "Đã nhận thông tin đặt phòng",
          );
          return json({ session: view(s) });
        }
        if (!act && m === "DELETE") {
          bump(s, { status: "cancelled", statusLabel: "Đơn đã huỷ" }, "GUEST_CANCELLED", "Bạn đã huỷ giữ phòng");
          return json({ session: view(s) });
        }
      }
      if (u.pathname === `${B}/checkin/lookup`) {
        const b = (await req.json()) as J;
        if (!String(b.phone).startsWith("09") || (b.secondKeyValue && !String(b.secondKeyValue).startsWith("EI"))) return err(404, "GUEST_LOOKUP_NO_MATCH", "Thông tin chưa khớp với đơn nào. Kiểm tra lại số điện thoại và thông tin thứ 2 nhé.");
        const ci = new Date(Date.now() + 2 * H).toISOString();
        return json({
          booking: { id: "EI-20261120-K7Q2", roomId: "sig-202", roomNumber: "202", roomName: "Signature 202", bookingType: "overnight", checkinAt: ci, checkoutAt: new Date(Date.now() + 14 * H).toISOString(), numGuests: 2, guestNameMasked: "Nguyễn V** An", status: "confirmed", remainingAmount: 0 },
          accessCodes: { ready: true, visible: true, visibleFrom: new Date(Date.now() - 4 * H).toISOString(), gateCode: "2580#", lockboxCode: "4321", wifiName: "DGH", wifiPassword: "0906314109", pendingNote: null },
          guideBlocks: {
            step1MainText: "Every Inn - 69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu. Google Maps Every Inn: https://maps.app.goo.gl/CV7RM9akRpGEx8Ds8?g_st=ic\n- Khi đến đúng nhà như ảnh, bạn nhập PASS: 2580#\n- Phòng 202\n- PASS hộp khoá lấy thẻ: 4321\nMở 2 cửa nhà bằng cách bấm EXIT cạnh cổng.\n- Vui lòng giữ kĩ thẻ phòng khi ra ngoài, trường hợp làm mất sẽ chịu phí 200.000/thẻ.\nWifi: DGH - Pass: 0906314109",
            step1GoogleMapsUrl: "https://maps.app.goo.gl/CV7RM9akRpGEx8Ds8?g_st=ic",
            step2Images: { checkinImageUrl: null, checkinImageAlt: "Hướng dẫn nhận phòng", checkoutImageUrl: null, checkoutImageAlt: "Hướng dẫn trả phòng" },
            step3TaxiText: "Nếu bạn đi taxi hãy book xe đến 71/31 Nguyễn Công Hoan là đầu hẻm, và mình đi bộ vào khoảng 30m như clip hướng dẫn là đến ạ.",
            step3TaxiDropoffAddress: "71/31 Nguyễn Công Hoan, Phường Cầu Kiệu, TP.HCM",
            step4Video: { videoUrl: null, posterUrl: null, caption: "Đường từ đầu hẻm 71/31 vào tới cửa Every Inn" },
          },
        });
      }
      return err(404, "ROUTE_NOT_FOUND", u.pathname);
    },
  } as unknown as Fetcher;
}

export function mockBffEnv() {
  return { BOOKING_CORE: mockBookingCore(), AGENT_CORE: mockAgentCore(), WEB_BOOKING_ENABLED: "true" };
}
