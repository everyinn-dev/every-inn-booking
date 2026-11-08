"use client";
/**
 * /checkin — phone + ONE second key (mã đặt phòng / mã thanh toán · tài khoản MXH · ngày nhận + số phòng) →
 * the owner's 4 blocks in a fixed order: (1) text + copy tiles for gate / room / lockbox / wifi, (2) check-in &
 * check-out pictures, (3) taxi note + copy the 71/31 address, (4) the alley video. Codes only inside the window.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { dayOf, timeOf, whenOf } from "@/shared/booking-kit/format";
import { api, copyText } from "@/lib/booking/client";

type KeyType = "booking_ref" | "social" | "checkin_date_room";

interface Guide {
  booking: { id: string; roomNumber: string | null; roomName: string | null; bookingType: string; checkinAt: string; checkoutAt: string; numGuests: number; guestNameMasked: string; status: string; remainingAmount: number };
  accessCodes: { ready: boolean; visible: boolean; visibleFrom: string; gateCode: string | null; lockboxCode: string | null; wifiName: string | null; wifiPassword: string | null; pendingNote: string | null };
  guideBlocks: {
    step1MainText: string;
    step1GoogleMapsUrl: string | null;
    step2Images: { checkinImageUrl: string | null; checkinImageAlt: string; checkoutImageUrl: string | null; checkoutImageAlt: string };
    step3TaxiText: string | null;
    step3TaxiDropoffAddress: string | null;
    step4Video: { videoUrl: string | null; posterUrl: string | null; caption: string };
  };
}

const KEYS: { type: KeyType; label: string }[] = [
  { type: "booking_ref", label: "Mã đặt phòng" },
  { type: "social", label: "Zalo / IG / FB" },
  { type: "checkin_date_room", label: "Ngày + phòng" },
];

export default function CheckinPage() {
  const q = useSearchParams();
  const [phone, setPhone] = useState(q.get("phone") ?? "");
  const [type, setType] = useState<KeyType>("booking_ref");
  const [value, setValue] = useState(q.get("ref") ?? "");
  const [date, setDate] = useState("");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async (label: string, v: string) => setToast((await copyText(v)) ? `Đã copy ${label}` : "Không copy được — giữ lâu để copy");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<Guide>("POST", "/api/guest/checkin/lookup", {
      phone,
      secondKeyType: type,
      ...(type === "checkin_date_room" ? { checkinDate: date, roomNumber: room } : { secondKeyValue: value }),
    });
    setBusy(false);
    if (r.ok && r.data) {
      setGuide(r.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else setError(r.error?.message ?? "Thông tin chưa khớp.");
  };

  if (guide) {
    const b = guide.booking;
    const c = guide.accessCodes;
    const g = guide.guideBlocks;
    const imgs = [
      { url: g.step2Images.checkinImageUrl, alt: g.step2Images.checkinImageAlt, cap: "Nhận phòng" },
      { url: g.step2Images.checkoutImageUrl, alt: g.step2Images.checkoutImageAlt, cap: "Trả phòng" },
    ];
    return (
      <main className="bk-page">
        <div className="bk-wrap" style={{ maxWidth: 640 }}>
          <h1 className="bk-title">Hướng dẫn nhận phòng</h1>
          <p className="bk-sub">
            {b.guestNameMasked} · Phòng {b.roomNumber} · {b.numGuests} khách
          </p>
          <div className="bk-card" style={{ marginTop: 12 }}>
            <div className="bk-times" style={{ marginTop: 0 }}>
              <div className="bk-time">
                <span>Nhận phòng</span>
                <strong>{timeOf(b.checkinAt)}</strong>
                <span>{dayOf(b.checkinAt)}</span>
              </div>
              <div className="bk-time">
                <span>Trả phòng</span>
                <strong>{timeOf(b.checkoutAt)}</strong>
                <span>{dayOf(b.checkoutAt)}</span>
              </div>
            </div>
            {b.remainingAmount > 0 && b.status === "confirmed" ? <div className="bk-banner bk-banner-warn" style={{ marginTop: 12 }}>Còn {b.remainingAmount.toLocaleString("vi-VN")}đ thanh toán khi nhận phòng.</div> : null}
            {c.pendingNote ? <div className={`bk-banner ${b.status === "cancelled" ? "bk-banner-danger" : "bk-banner-info"}`} style={{ marginTop: 12 }}>{c.pendingNote}</div> : null}
          </div>

          {/* 1 — text + copy tiles */}
          <section className="bk-card">
            <div className="bk-section-label">
              <span className="bk-block-n">1</span>Mã cửa & nội quy
            </div>
            <div className="bk-codes">
              {[
                ["Mã cổng", c.gateCode, "mã cổng"],
                ["Phòng", b.roomNumber, "số phòng"],
                ["Hộp khoá lấy thẻ", c.lockboxCode, "mã hộp khoá"],
                ["Wifi " + (c.wifiName ?? ""), c.wifiPassword, "mật khẩu wifi"],
              ].map(([label, v, copyLabel]) => (
                <button key={label as string} type="button" className="bk-code" data-locked={!v} onClick={() => v && copy(copyLabel as string, v)} disabled={!v}>
                  <span>{label}</span>
                  <strong>{v ?? "••••"}</strong>
                  <small>{v ? "Chạm để copy" : c.visible ? "Đang chuẩn bị" : `Hiện lúc ${whenOf(c.visibleFrom)}`}</small>
                </button>
              ))}
            </div>
            <p className="bk-guide-text" style={{ marginTop: 12 }}>
              {g.step1MainText}
            </p>
            <div className="bk-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
              {g.step1GoogleMapsUrl ? (
                <a className="bk-btn bk-btn-primary" href={g.step1GoogleMapsUrl} target="_blank" rel="noopener noreferrer">
                  Mở Google Maps
                </a>
              ) : null}
              {c.ready ? (
                <button type="button" className="bk-btn bk-btn-outline" onClick={() => copy("hướng dẫn", g.step1MainText)}>
                  Copy toàn bộ
                </button>
              ) : null}
            </div>
          </section>

          {/* 2 — pictures */}
          <section className="bk-card">
            <div className="bk-section-label">
              <span className="bk-block-n">2</span>Hình hướng dẫn
            </div>
            <div className="bk-guide-imgs">
              {imgs.map((im) => (
                <figure key={im.cap}>
                  <button type="button" onClick={() => im.url && setZoom(im.url)} disabled={!im.url} aria-label={`Phóng to: ${im.alt}`}>
                    {im.url ? <img src={im.url} alt={im.alt} loading="lazy" /> : <div className="bk-placeholder">Ảnh hướng dẫn {im.cap.toLowerCase()} sắp cập nhật</div>}
                  </button>
                  <figcaption>{im.cap}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          {/* 3 — taxi */}
          {g.step3TaxiText ? (
            <section className="bk-card">
              <div className="bk-section-label">
                <span className="bk-block-n">3</span>Đi taxi / xe công nghệ
              </div>
              <p className="bk-guide-text">{g.step3TaxiText}</p>
              {g.step3TaxiDropoffAddress ? (
                <button type="button" className="bk-btn bk-btn-outline bk-btn-block" style={{ marginTop: 12 }} onClick={() => copy("địa chỉ đặt xe", g.step3TaxiDropoffAddress!)}>
                  Copy địa chỉ {g.step3TaxiDropoffAddress.split(",")[0]} để đặt Grab/Be
                </button>
              ) : null}
            </section>
          ) : null}

          {/* 4 — video */}
          <section className="bk-card">
            <div className="bk-section-label">
              <span className="bk-block-n">4</span>Video lối vào
            </div>
            {g.step4Video.videoUrl ? (
              <video className="bk-video" src={g.step4Video.videoUrl} poster={g.step4Video.posterUrl ?? undefined} controls playsInline preload="metadata" />
            ) : (
              <div className="bk-placeholder" style={{ minHeight: 120 }}>
                Video đường vào sắp cập nhật — bạn xem ảnh ở mục 2 nhé.
              </div>
            )}
            <p className="bk-help">{g.step4Video.caption}</p>
          </section>

          <button type="button" className="bk-btn bk-btn-ghost bk-btn-block" onClick={() => setGuide(null)}>
            Tra cứu đơn khác
          </button>
        </div>
        {zoom ? (
          <div className="bk-lightbox" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
            <img src={zoom} alt="Ảnh hướng dẫn" />
          </div>
        ) : null}
        {toast ? (
          <div className="bk-toast" role="status">
            {toast}
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="bk-page">
      <div className="bk-wrap" style={{ maxWidth: 520 }}>
        <h1 className="bk-title">Tra cứu mã phòng & hướng dẫn check-in</h1>
        <p className="bk-sub">Nhập số điện thoại đã đặt phòng và thêm 1 thông tin để xác thực.</p>
        <form className="bk-card" style={{ marginTop: 16 }} onSubmit={submit} noValidate>
          <label className="bk-field" style={{ marginTop: 0 }}>
            <span className="bk-field-label">Số điện thoại</span>
            <input className="bk-input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0906 123 456" required />
          </label>
          <div className="bk-field">
            <span className="bk-field-label">Thông tin thứ 2</span>
            <div className="bk-seg" role="group" aria-label="Loại thông tin thứ 2">
              {KEYS.map((k) => (
                <button key={k.type} type="button" aria-pressed={type === k.type} onClick={() => setType(k.type)}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          {type === "checkin_date_room" ? (
            <div className="bk-grid-2">
              <label className="bk-field">
                <span className="bk-field-label">Ngày nhận phòng</span>
                <input className="bk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="bk-field">
                <span className="bk-field-label">Số phòng</span>
                <input className="bk-input" inputMode="numeric" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="202" />
              </label>
            </div>
          ) : (
            <label className="bk-field">
              <span className="bk-field-label">{type === "booking_ref" ? "Mã đặt phòng hoặc nội dung chuyển khoản" : "Zalo / Instagram / Facebook đã dùng khi đặt"}</span>
              <input className="bk-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "booking_ref" ? "EI-20261120-K7Q2 hoặc EIPAY…" : "@tenban hoặc số Zalo"} />
            </label>
          )}
          {error ? <div className="bk-banner bk-banner-danger" style={{ marginTop: 12 }}>{error}</div> : null}
          <button type="submit" className="bk-btn bk-btn-primary bk-btn-block" style={{ marginTop: 16 }} disabled={busy || !phone.trim()}>
            {busy ? "Đang tra cứu…" : "Xem hướng dẫn"}
          </button>
          <p className="bk-help" style={{ textAlign: "center" }}>Mã cửa chỉ hiện trước giờ nhận phòng và chỉ cho người có đủ 2 thông tin.</p>
        </form>
      </div>
    </main>
  );
}
