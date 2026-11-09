"use client";

import { useEffect, useState } from "react";
import { vnd } from "@/shared/booking-kit/format";
import type { SearchRoom } from "@/shared/booking-kit/types";
import type { Addons } from "./RoomResultCard";

export interface HoldConflict {
  existingRoomLabel: string;
  remainingSeconds: number;
}

interface PhoneHoldModalProps {
  open: boolean;
  room: SearchRoom | null;
  addons: Addons;
  staySubtitle: string;
  total: number;
  onClose: () => void;
  onConfirm: (phone: string, forceSwitch?: boolean) => Promise<{ ok: boolean; conflict?: HoldConflict; error?: string }>;
}

export default function PhoneHoldModal({
  open,
  room,
  addons,
  staySubtitle,
  total,
  onClose,
  onConfirm,
}: PhoneHoldModalProps) {
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<HoldConflict | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setConflict(null);
      return;
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem("ei_guest_phone") : null;
    if (saved) setPhone(saved);
  }, [open]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open || !room) return null;

  const cleanPhone = phone.replace(/\D/g, "").replace(/^84/, "0");
  const phoneOk = /^0[35789]\d{8}$/.test(cleanPhone);

  const handleSubmit = async (e?: React.FormEvent, forceSwitch = false) => {
    if (e) e.preventDefault();
    if (!phoneOk) {
      setError("Vui lòng nhập số điện thoại di động Việt Nam (vd: 0906 123 456).");
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await onConfirm(cleanPhone, forceSwitch);
    setSubmitting(false);

    if (res.ok) {
      try {
        localStorage.setItem("ei_guest_phone", cleanPhone);
      } catch {}
      onClose();
    } else if (res.conflict) {
      setConflict(res.conflict);
    } else {
      setError(res.error ?? "Chưa giữ được phòng, bạn thử lại nhé.");
    }
  };

  const remainingMinutes = conflict ? Math.max(1, Math.ceil(conflict.remainingSeconds / 60)) : 10;

  return (
    <>
      <div className="bk-scrim" onClick={() => !submitting && onClose()} />
      <div className="bk-sheet" role="dialog" aria-modal="true" aria-labelledby="bk-hold-title">
        <div className="bk-between" style={{ marginBottom: 8 }}>
          <div>
            <h3 id="bk-hold-title" style={{ margin: 0, fontSize: 18 }}>
              Giữ phòng {room.room.roomNumber}
            </h3>
            <p className="bk-sub" style={{ margin: "2px 0 0" }}>
              {staySubtitle}
              {addons.early ? ` · +${addons.early}h sớm` : ""}
              {addons.late ? ` · +${addons.late}h muộn` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong style={{ fontSize: 17 }}>{vnd(total)}</strong>
            <div className="bk-small bk-muted">Tạm tính</div>
          </div>
        </div>

        <hr className="bk-hr" />

        {conflict ? (
          <div style={{ marginTop: 12 }}>
            <div className="bk-banner bk-banner-warn" style={{ marginBottom: 14 }}>
              <div>
                <strong>Số điện thoại đang giữ phòng khác</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}>
                  Bạn đang có 1 đơn giữ <b>{conflict.existingRoomLabel}</b> (còn khoảng {remainingMinutes} phút). Bạn có muốn huỷ phòng cũ để chuyển sang giữ phòng <b>{room.room.roomNumber}</b> này không?
                </p>
              </div>
            </div>
            <button
              type="button"
              className="bk-btn bk-btn-primary bk-btn-block"
              onClick={() => handleSubmit(undefined, true)}
              disabled={submitting}
            >
              {submitting ? "Đang đổi phòng…" : `Đổi sang phòng ${room.room.roomNumber}`}
            </button>
            <button
              type="button"
              className="bk-btn bk-btn-outline bk-btn-block"
              style={{ marginTop: 8 }}
              onClick={onClose}
              disabled={submitting}
            >
              Giữ nguyên phòng cũ
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => handleSubmit(e, false)} style={{ marginTop: 12 }}>
            <label className="bk-field" style={{ marginTop: 0 }}>
              <span className="bk-field-label">Số điện thoại của bạn</span>
              <input
                className="bk-input"
                type="tel"
                inputMode="numeric"
                autoFocus
                placeholder="0906 123 456"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) setError(null);
                }}
                disabled={submitting}
                aria-invalid={!!error}
              />
              <p className="bk-help">
                Home bảo lưu phòng cho riêng bạn trong 10 phút và gửi mã khóa phòng qua Zalo/SMS.
              </p>
              {error ? <p className="bk-error-text">{error}</p> : null}
            </label>

            <div style={{ marginTop: 16 }}>
              <button
                type="submit"
                className="bk-btn bk-btn-primary bk-btn-block"
                disabled={submitting || !cleanPhone}
              >
                {submitting ? "Đang bảo lưu…" : "Bảo lưu phòng 10 phút"}
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-ghost bk-btn-block"
                style={{ marginTop: 4 }}
                onClick={onClose}
                disabled={submitting}
              >
                Để sau
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

