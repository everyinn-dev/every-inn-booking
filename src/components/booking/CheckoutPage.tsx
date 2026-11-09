"use client";
/**
 * /dat-phong/<token> — one page, the session drives it: thông tin → thanh toán (VietQR) → chờ xác nhận → xong.
 * Realtime: long-poll on the session (agent-core Durable Object) — the page flips < 1 s after ✅ on Telegram.
 * Leaving: "Huỷ", "Đổi phòng" and the browser Back button open a confirmation sheet (room goes back on sale);
 * closing / hiding the tab never cancels (the guest switches to the banking app).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dayOf, mmss, stayLabel, timeOf, vnd } from "@/shared/booking-kit/format";
import { useLongPoll, useServerCountdown } from "@/shared/booking-kit/live";
import { LIVE_STATUSES, TIER_LABEL, type Preview, type SessionView } from "@/shared/booking-kit/types";
import { api, copyText, roomMedia, writeActiveHold } from "@/lib/booking/client";

const roomNumberOf = (s: SessionView) => s.room.id.split("-").pop() ?? s.room.id;

function useToast(): [string | null, (t: string) => void] {
  const [t, set] = useState<string | null>(null);
  useEffect(() => {
    if (!t) return;
    const x = setTimeout(() => set(null), 3500);
    return () => clearTimeout(x);
  }, [t]);
  return [t, set];
}

export default function CheckoutPage({ token, initial }: { token: string; initial: SessionView | null }) {
  const router = useRouter();
  const [toast, say] = useToast();
  const live = useLongPoll<SessionView>({
    url: (v) => `/api/guest/sessions/${token}/live?v=${v}`,
    initial,
    pick: (b) => (b as { data?: { session?: SessionView } }).data?.session ?? null,
  });
  const s = live.data;
  const left = useServerCountdown(s?.expiresAt, s?.serverNow);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<null | "cancel" | "change">(null);

  // keep "the hold this browser works on" in sync (other tabs show a banner)
  useEffect(() => {
    if (!s) return;
    if (LIVE_STATUSES.includes(s.status)) writeActiveHold({ token, roomLabel: s.room.label, expiresAt: s.expiresAt });
    else writeActiveHold(null);
  }, [s, token]);

  // Back button guard (popstate): only while the room is held and cancellable
  const guard = !!s && s.can.cancel;
  useEffect(() => {
    if (!guard) return;
    history.pushState({ eiGuard: true }, "");
    const onPop = () => {
      history.pushState({ eiGuard: true }, "");
      setSheet("change");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [guard]);

  if (!s) {
    return (
      <main className="bk-page">
        <div className="bk-wrap">
          <div className="bk-card bk-empty">
            <p className="bk-strong">Không tìm thấy phiên đặt phòng</p>
            <p className="bk-sub">Đường dẫn đã cũ hoặc không đúng.</p>
            <Link className="bk-btn bk-btn-primary" style={{ marginTop: 12 }} href="/dat-phong">
              Tìm phòng
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isLive = LIVE_STATUSES.includes(s.status);
  const step = s.status === "holding" || editing ? 1 : s.status === "awaiting_payment" || s.status === "underpaid" ? 2 : 3;
  const media = roomMedia(roomNumberOf(s));
  const cancel = async () => {
    setSheet(null);
    const r = await api<{ session: SessionView }>("DELETE", `/api/guest/sessions/${token}`);
    if (r.ok && r.data) live.setData(r.data.session);
    else say(r.error?.message ?? "Chưa huỷ được, thử lại nhé.");
    if (sheet === "change") router.push("/dat-phong");
  };

  return (
    <main className="bk-page">
      {isLive ? (
        <div className="bk-timer" data-urgent={left < 120} role="timer" aria-live="off">
          <div className="bk-timer-inner">
            <span>{s.status === "payment_claimed" ? "Home đang đối soát — phòng vẫn được giữ" : "Đang giữ phòng cho bạn"}</span>
            <b>{mmss(left)}</b>
          </div>
        </div>
      ) : null}
      <div className="bk-wrap">
        <div className="bk-steps" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span key={i} className="bk-step" data-on={step >= i} />
          ))}
        </div>
        <div className="bk-checkout" data-final={!isLive}>
          <section>
            {s.status === "holding" || (editing && s.can.editGuest) ? (
              <GuestForm token={token} session={s} onSaved={(n) => (live.setData(n), setEditing(false))} say={say} />
            ) : s.status === "awaiting_payment" || s.status === "underpaid" ? (
              <PaymentPanel token={token} session={s} onUpdate={live.setData} say={say} onEdit={() => setEditing(true)} />
            ) : s.status === "payment_claimed" || s.status === "confirming" || s.status === "late_payment" ? (
              <Waiting session={s} />
            ) : s.status === "confirmed" ? (
              <Done session={s} />
            ) : (
              <Ended session={s} />
            )}
            {!live.online ? <p className="bk-help">Mất kết nối — đang thử lại…</p> : null}
          </section>
          <aside>
            <div className="bk-card">
              <div className="bk-summary">
                {media.image ? <img src={media.image} alt={s.room.label} /> : <div />}
                <div>
                  <div className="bk-strong">{s.room.label}</div>
                  <div className="bk-small bk-muted">{stayLabel({ bookingType: s.bookingType, shift: s.shift, earlyHours: s.earlyHours, lateHours: s.lateHours, checkinAt: s.checkinAt, checkoutAt: s.checkoutAt })}</div>
                  <div className="bk-small bk-muted">{s.numGuests} khách</div>
                </div>
              </div>
              <div className="bk-times">
                <div className="bk-time">
                  <span>Nhận phòng</span>
                  <strong>{timeOf(s.checkinAt)}</strong>
                  <span>{dayOf(s.checkinAt)}</span>
                </div>
                <div className="bk-time">
                  <span>Trả phòng</span>
                  <strong>{timeOf(s.checkoutAt)}</strong>
                  <span>{dayOf(s.checkoutAt)}</span>
                </div>
              </div>
              <hr className="bk-hr" />
              <PriceLines s={s} />
              {s.can.cancel ? (
                <div className="bk-between" style={{ marginTop: 12 }}>
                  <button type="button" className="bk-link" onClick={() => setSheet("change")}>
                    Đổi phòng / giờ
                  </button>
                  <button type="button" className="bk-btn bk-btn-danger" style={{ minHeight: 40 }} onClick={() => setSheet("cancel")}>
                    Huỷ giữ phòng
                  </button>
                </div>
              ) : null}
            </div>
            {s.timeline.length ? (
              <div className="bk-card">
                <div className="bk-section-label">Tiến trình</div>
                <ul className="bk-timeline">
                  {s.timeline.map((e, i) => (
                    <li key={`${e.event}-${i}`}>
                      <span>{e.label}</span>
                      <time>{timeOf(e.at)}</time>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {sheet ? (
        <>
          <div className="bk-scrim" onClick={() => setSheet(null)} />
          <div className="bk-sheet" role="dialog" aria-modal="true" aria-labelledby="bk-sheet-title">
            <h3 id="bk-sheet-title">{sheet === "change" ? "Đổi phòng hoặc giờ?" : "Huỷ giữ phòng?"}</h3>
            <p className="bk-sub">Phòng {s.room.label} sẽ được trả lại ngay cho khách khác. Nếu bạn đã chuyển khoản, đừng huỷ — bấm “Tôi đã chuyển khoản”.</p>
            <div style={{ marginTop: 16 }}>
              <button type="button" className="bk-btn bk-btn-primary bk-btn-block" onClick={() => setSheet(null)}>
                Tiếp tục giữ phòng
              </button>
              <button type="button" className="bk-btn bk-btn-danger bk-btn-block" onClick={cancel}>
                {sheet === "change" ? "Huỷ & chọn lại" : "Huỷ giữ phòng"}
              </button>
            </div>
          </div>
        </>
      ) : null}
      {toast ? (
        <div className="bk-toast" role="status">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function PriceLines({ s }: { s: SessionView }) {
  const p = s.pricing;
  return (
    <div className="bk-lines">
      {p ? (
        <>
          <div className="bk-between">
            <span>Tiền phòng + phụ thu</span>
            <span>{vnd(p.subtotal)}</span>
          </div>
          {p.promotion ? (
            <div className="bk-between bk-discount">
              <span>{p.promotion.name}</span>
              <span>−{vnd(p.promotion.discount)}</span>
            </div>
          ) : null}
          {p.voucher ? (
            <div className="bk-between bk-discount">
              <span>Voucher {p.voucher.codeMasked}</span>
              <span>−{vnd(p.voucher.discount)}</span>
            </div>
          ) : null}
        </>
      ) : null}
      {s.paidAmount > 0 ? (
        <div className="bk-between">
          <span>Đã nhận</span>
          <span>{vnd(s.paidAmount)}</span>
        </div>
      ) : null}
      <div className="bk-between bk-total">
        <span>{s.paidAmount > 0 && s.remaining > 0 ? "Còn lại" : "Tổng cộng"}</span>
        <span>{vnd(s.paidAmount > 0 && s.remaining > 0 ? s.remaining : s.amountDue)}</span>
      </div>
    </div>
  );
}

// ── Step 1: guest info + member / voucher / promotion code ──────────────────────────────────

function GuestForm({ token, session, onSaved, say }: { token: string; session: SessionView; onSaved: (s: SessionView) => void; say: (t: string) => void }) {
  const g = session.guest;
  const [name, setName] = useState(g?.name ?? "");
  const [phone, setPhone] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("ei_guest_phone") : "") || g?.phone || "");
  const [zalo, setZalo] = useState("");
  const [social, setSocial] = useState(!!(g?.instagram || g?.facebook));
  const [ig, setIg] = useState(g?.instagram ?? "");
  const [fb, setFb] = useState(g?.facebook ?? "");
  const [note, setNote] = useState(g?.note ?? "");
  const [code, setCode] = useState("");
  const [codeApplied, setCodeApplied] = useState<string | null>(null);
  const [voucherId, setVoucherId] = useState<string | null | "none">(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const phoneOk = /^0[35789]\d{8}$/.test(phone.replace(/\D/g, "").replace(/^84/, "0"));

  const runPreview = useCallback(
    async (opts: { promotionCode?: string | null; voucher?: string | null | "none" } = {}) => {
      const r = await api<Preview>("POST", `/api/guest/sessions/${token}/preview`, {
        ...(phoneOk ? { phone } : {}),
        ...((opts.promotionCode ?? codeApplied) ? { promotionCode: opts.promotionCode ?? codeApplied } : {}),
        ...((opts.voucher ?? voucherId) === "none" ? { noVoucher: true } : (opts.voucher ?? voucherId) ? { voucherId: opts.voucher ?? voucherId } : {}),
      });
      if (r.ok && r.data) setPreview(r.data);
      return r;
    },
    [token, phone, phoneOk, codeApplied, voucherId],
  );

  // the member tier + voucher wallet appear as soon as the phone is valid (debounced)
  const lastPhone = useRef("");
  useEffect(() => {
    if (!phoneOk || lastPhone.current === phone) return;
    lastPhone.current = phone;
    const t = setTimeout(() => runPreview(), 400);
    return () => clearTimeout(t);
  }, [phone, phoneOk, runPreview]);

  const applyCode = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    const r = await runPreview({ promotionCode: c });
    const promo = r.data?.pricing.promotion;
    if (r.ok && promo?.eligible) {
      setCodeApplied(c);
      say(`Đã áp dụng ${promo.name ?? c}`);
      setErrors((e) => ({ ...e, code: "" }));
    } else setErrors((e) => ({ ...e, code: promo?.reason ?? r.error?.message ?? "Mã không áp dụng được." }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Nhập họ tên người nhận phòng.";
    if (!phoneOk) errs.phone = "Số di động Việt Nam 10 số, vd 0906 123 456.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const r = await api<{ session: SessionView }>("PATCH", `/api/guest/sessions/${token}`, {
      guest: { name, phone, zalo: zalo || undefined, instagram: social ? ig : undefined, facebook: social ? fb : undefined, note },
      ...(codeApplied ? { promotionCode: codeApplied } : {}),
      ...(voucherId === "none" ? { noVoucher: true } : voucherId ? { voucherId } : {}),
    });
    setSaving(false);
    if (r.ok && r.data) onSaved(r.data.session);
    else {
      if (r.error?.code === "INVALID_PHONE" || r.error?.code === "PHONE_REQUIRED") setErrors({ phone: r.error.message });
      say(r.error?.message ?? "Chưa lưu được, thử lại nhé.");
    }
  };

  const vouchers = preview?.vouchers ?? [];
  const appliedVoucher = preview?.pricing.voucher?.id ?? null;
  return (
    <form className="bk-card" onSubmit={submit} noValidate>
      <h1 className="bk-title" style={{ marginTop: 0 }}>
        Thông tin nhận phòng
      </h1>
      <p className="bk-sub">Home dùng số điện thoại để xác nhận và để bạn tra cứu mã phòng.</p>
      <label className="bk-field">
        <span className="bk-field-label">
          Số điện thoại <span style={{ color: "var(--bk-danger)" }}>*</span>
        </span>
        <input className="bk-input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} placeholder="0906 123 456" />
        {errors.phone ? <p className="bk-error-text">{errors.phone}</p> : null}
        {preview?.member?.found ? <p style={{ marginTop: 8 }}><span className="bk-member">★ {TIER_LABEL[preview.member.tier ?? ""] ?? "Hội viên"} — chào mừng bạn quay lại!</span></p> : null}
      </label>
      <label className="bk-field">
        <span className="bk-field-label">
          Họ tên <span style={{ color: "var(--bk-danger)" }}>*</span>
        </span>
        <input className="bk-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} placeholder="Nguyễn Văn An" />
        {errors.name ? <p className="bk-error-text">{errors.name}</p> : null}
      </label>
      <label className="bk-field">
        <span className="bk-field-label">Zalo</span>
        <input className="bk-input" value={zalo} onChange={(e) => setZalo(e.target.value)} placeholder={phone ? `Mặc định: ${phone}` : "Số Zalo (nếu khác số điện thoại)"} />
      </label>
      {social ? (
        <div className="bk-grid-2">
          <label className="bk-field">
            <span className="bk-field-label">Instagram</span>
            <input className="bk-input" value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@tenban" />
          </label>
          <label className="bk-field">
            <span className="bk-field-label">Facebook</span>
            <input className="bk-input" value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Tên / link" />
          </label>
        </div>
      ) : (
        <button type="button" className="bk-link" style={{ marginTop: 10 }} onClick={() => setSocial(true)}>
          + Thêm Instagram / Facebook
        </button>
      )}
      <label className="bk-field">
        <span className="bk-field-label">Ghi chú cho Home</span>
        <input className="bk-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vd: mình đến khoảng 21h15" maxLength={300} />
      </label>

      {vouchers.length ? (
        <div className="bk-field">
          <span className="bk-field-label">Voucher của bạn</span>
          <div className="bk-vouchers">
            {vouchers.map((v) => (
              <button key={v.id} type="button" className="bk-voucher" aria-pressed={appliedVoucher === v.id} onClick={() => (setVoucherId(v.id), runPreview({ voucher: v.id }))}>
                <span style={{ fontSize: 22 }}>🎟</span>
                <span>
                  <b>Giảm {vnd(v.value)}</b>
                  <small>
                    {v.label} · {v.codeMasked} · hết hạn {dayOf(v.expiresAt)}
                  </small>
                </span>
              </button>
            ))}
            <button type="button" className="bk-voucher" aria-pressed={!appliedVoucher} onClick={() => (setVoucherId("none"), runPreview({ voucher: "none" }))}>
              <span style={{ fontSize: 22 }}>—</span>
              <span>
                <b>Không dùng voucher lần này</b>
              </span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="bk-field">
        <span className="bk-field-label">Mã ưu đãi</span>
        <div className="bk-row">
          <input className="bk-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Nhập mã (nếu có)" aria-invalid={!!errors.code} />
          <button type="button" className="bk-btn bk-btn-outline" onClick={applyCode} disabled={!code.trim()}>
            Áp dụng
          </button>
        </div>
        {errors.code ? <p className="bk-error-text">{errors.code}</p> : codeApplied ? <p className="bk-help">Đã áp dụng mã {codeApplied}.</p> : null}
      </div>

      {preview ? (
        <div className="bk-note" style={{ marginTop: 16 }}>
          <div className="bk-between">
            <span>Tạm tính</span>
            <b>{vnd(preview.pricing.total)}</b>
          </div>
          {preview.pricing.promotion?.eligible && preview.pricing.promotion.discount ? <div className="bk-small bk-discount">{preview.pricing.promotion.name}: −{vnd(preview.pricing.promotion.discount)}</div> : null}
          {preview.pricing.voucher ? <div className="bk-small bk-discount">Voucher: −{vnd(preview.pricing.voucher.discount)}</div> : null}
        </div>
      ) : null}

      <button type="submit" className="bk-btn bk-btn-primary bk-btn-block" style={{ marginTop: 16 }} disabled={saving}>
        {saving ? "Đang lưu…" : "Tiếp tục thanh toán"}
      </button>
    </form>
  );
}

// ── Step 2: VietQR ──────────────────────────────────────────────────────────────────────────

function PaymentPanel({ token, session: s, onUpdate, say, onEdit }: { token: string; session: SessionView; onUpdate: (s: SessionView) => void; say: (t: string) => void; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const p = s.payment;
  const rejected = useMemo(() => s.timeline.at(-1)?.event === "OWNER_REJECTED", [s.timeline]);
  const copy = async (label: string, v: string) => say((await copyText(v)) ? `Đã copy ${label}` : "Không copy được — giữ lâu để copy");
  const claim = async () => {
    if (busyRef.current || busy) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await api<{ session: SessionView }>("POST", `/api/guest/sessions/${token}/paid`, {});
      if (r.ok && r.data) onUpdate(r.data.session);
      else say(r.error?.message ?? "Chưa gửi được, thử lại nhé.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="bk-card">
      <h1 className="bk-title" style={{ marginTop: 0 }}>
        {s.status === "underpaid" ? "Chuyển bù phần còn thiếu" : "Chuyển khoản để chốt phòng"}
      </h1>
      {s.status === "underpaid" ? <div className="bk-banner bk-banner-warn">Home đã nhận {vnd(s.paidAmount)}, còn thiếu <b>{vnd(s.remaining)}</b>. Bạn quét mã bên dưới để chuyển bù nhé.</div> : null}
      {rejected ? (
        <div className="bk-banner bk-banner-danger">
          {s.status === "underpaid"
            ? "Home chưa thấy khoản tiền chuyển bù về tài khoản. Bạn kiểm tra lại giao dịch, chuyển lại nếu cần rồi bấm “Tôi đã chuyển bù”."
            : "Home chưa thấy tiền về tài khoản. Bạn kiểm tra lại giao dịch, chuyển lại nếu cần rồi bấm “Tôi đã chuyển lại”."}
        </div>
      ) : null}
      {p ? (
        <>
          <div className="bk-qr" style={{ marginTop: 12 }}>
            {p.qrUrl ? <img src={p.qrUrl} alt={`Mã VietQR chuyển ${vnd(p.amount)}`} /> : null}
            {p.qrUrl ? (
              <a className="bk-link bk-small" href={p.qrUrl} download={`everyinn-${p.reference}.png`} target="_blank" rel="noopener noreferrer">
                Tải mã QR
              </a>
            ) : null}
            <p className="bk-small bk-muted">Mở app ngân hàng → Quét QR. Số tiền và nội dung đã điền sẵn.</p>
          </div>
          <div style={{ marginTop: 8 }}>
            {[
              ["Ngân hàng", p.bankId === "MB" ? "MB Bank (Quân Đội)" : (p.bankId ?? ""), null],
              ["Số tài khoản", p.account ?? "", "số tài khoản"],
              ["Chủ tài khoản", p.holderName ?? "", null],
              ["Số tiền", vnd(p.amount), "số tiền"],
              ["Nội dung", p.reference, "nội dung"],
            ].map(([label, value, copyLabel]) => (
              <div className="bk-copy-row" key={label as string}>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
                {copyLabel ? (
                  <button type="button" className="bk-copy" onClick={() => copy(copyLabel as string, label === "Số tiền" ? String(p.amount) : (value as string))}>
                    Copy
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
      <button type="button" className="bk-btn bk-btn-primary bk-btn-block" style={{ marginTop: 16 }} onClick={claim} disabled={busy}>
        {busy ? "Đang báo Home…" : rejected ? "Tôi đã chuyển lại" : s.status === "underpaid" ? "Tôi đã chuyển bù" : "Tôi đã chuyển khoản"}
      </button>
      {s.can.editGuest ? (
        <button type="button" className="bk-btn bk-btn-ghost bk-btn-block" onClick={onEdit}>
          Sửa thông tin / mã ưu đãi
        </button>
      ) : null}
    </div>
  );
}

// ── Step 3 ──────────────────────────────────────────────────────────────────────────────────

function Waiting({ session: s }: { session: SessionView }) {
  const isTopup = s.paidAmount > 0;
  return (
    <div className="bk-card bk-wait" aria-live="polite">
      <div className="bk-pulse" aria-hidden />
      <h1 className="bk-title">
        {s.status === "late_payment"
          ? "Home đang kiểm tra lại phòng cho bạn"
          : isTopup
            ? "Home đang đối soát phần chuyển bù"
            : "Home đang đối soát chuyển khoản"}
      </h1>
      <p className="bk-sub">Thường mất 30 giây – 2 phút. Trang sẽ tự chuyển khi Home xác nhận — bạn không cần tải lại.</p>
      {isTopup ? <p className="bk-small bk-muted">Đã nhận: {vnd(s.paidAmount)} · Chuyển bù: {vnd(s.remaining)}</p> : null}
      <p className="bk-small bk-muted">Mã thanh toán: {s.payment?.reference ?? "—"}</p>
    </div>
  );
}

function Done({ session: s }: { session: SessionView }) {
  return (
    <div className="bk-card bk-done">
      <div className="bk-done-icon" aria-hidden>
        ✓
      </div>
      <h1 className="bk-title">Đặt phòng thành công!</h1>
      <p className="bk-sub">
        Mã đặt phòng <b style={{ color: "var(--c-black)" }}>{s.bookingId}</b>
      </p>
      <p className="bk-small bk-muted">Mã cổng & hộp khoá hiện ở trang check-in trước giờ nhận phòng.</p>
      <Link className="bk-btn bk-btn-primary bk-btn-block" style={{ marginTop: 8 }} href={`/checkin?ref=${encodeURIComponent(s.bookingId ?? "")}`}>
        Xem hướng dẫn check-in
      </Link>
      <a className="bk-btn bk-btn-ghost bk-btn-block" href="https://www.instagram.com/everyinn.home/" target="_blank" rel="noopener noreferrer">
        Nhắn Home khi cần hỗ trợ
      </a>
    </div>
  );
}

function Ended({ session: s }: { session: SessionView }) {
  const text: Record<string, string> = {
    expired: "Hết 10 phút giữ phòng nên phòng đã được trả lại. Nếu bạn đã chuyển khoản, bấm nút bên dưới để Home kiểm tra lại cho bạn.",
    cancelled: "Đơn giữ phòng đã huỷ. Cần hỗ trợ bạn nhắn Home nhé.",
    conflict: "Phòng vừa có khách khác trước khi Home nhận được tiền của bạn. Home sẽ liên hệ đổi phòng tương đương hoặc hoàn tiền ngay.",
  };
  return (
    <div className="bk-card bk-empty">
      <p className="bk-strong">{s.statusLabel}</p>
      <p className="bk-sub">{text[s.status] ?? ""}</p>
      <Link className="bk-btn bk-btn-primary" style={{ marginTop: 12 }} href="/dat-phong">
        Tìm phòng khác
      </Link>
      {s.can.claimPaid ? <LateClaim session={s} /> : null}
    </div>
  );
}

function LateClaim({ session: s }: { session: SessionView }) {
  const [sent, setSent] = useState(false);
  const token = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";
  return sent ? (
    <p className="bk-help">Home đã nhận thông báo, sẽ kiểm tra và liên hệ bạn.</p>
  ) : (
    <button type="button" className="bk-btn bk-btn-ghost" onClick={async () => (await api("POST", `/api/guest/sessions/${token}/paid`, {}), setSent(true))}>
      Tôi đã chuyển khoản {s.payment ? vnd(s.payment.amount) : ""}
    </button>
  );
}
