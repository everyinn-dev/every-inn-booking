"use client";
/**
 * LSB-4 room card: photo, class, facts, the Core price (best public promotion applied) and — overnight — the add-on
 * chips (+1h nhận sớm / +1h trả muộn, 60.000đ/giờ) exactly as Booking Core allows them (shift matrix, 60' turnover
 * both ways, contiguity). A busy room stays visible but dimmed with "Vừa được đặt" (owner 2026-11-08).
 */
import { vnd } from "@/shared/booking-kit/format";
import type { AddonOption, SearchRoom } from "@/shared/booking-kit/types";
import { roomMedia } from "@/lib/booking/client";

export interface Addons {
  early: number;
  late: number;
}

export function addonFee(room: SearchRoom, a: Addons): number {
  return (a.early + a.late) * (room.overnightAddons?.surchargePerHour ?? 60_000);
}

/** Display total = Core total for the base shift + table fee of the chosen add-on hours (the hold re-prices in Core). */
export function displayTotal(room: SearchRoom, a: Addons): number {
  const base = room.price?.total ?? room.price?.subtotal ?? 0;
  return base + addonFee(room, a);
}

function Chips(props: { options: AddonOption[]; value: number; onPick: (h: number) => void; label: string }) {
  if (!props.options.length) return null;
  return (
    <div className="bk-addon-group" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.hours}
          type="button"
          className="bk-addon"
          aria-pressed={props.value === o.hours}
          disabled={!o.available}
          title={o.available ? o.label : `${o.label} — không còn trống`}
          onClick={() => props.onPick(props.value === o.hours ? 0 : o.hours)}
        >
          {o.shortLabel} <b>+{Math.round(o.surchargeVnd / 1000)}k</b>
        </button>
      ))}
    </div>
  );
}

export default function RoomResultCard(props: { room: SearchRoom; selected: boolean; addons: Addons; onAddons: (a: Addons) => void; onSelect: () => void; fresh?: boolean }) {
  const { room: r, selected, addons } = props;
  const m = roomMedia(r.room.roomNumber);
  const busy = !r.available;
  const promo = r.price?.promotion;
  const total = displayTotal(r, addons);
  const a = r.overnightAddons;
  return (
    <article className={`bk-room${props.fresh ? " bk-fresh" : ""}`} data-selected={selected} data-busy={busy} aria-label={r.room.name}>
      <div className="bk-room-media">
        {m.image ? <img src={m.image} alt={`Phòng ${r.room.name}`} loading="lazy" /> : null}
        <span className="bk-badge">{r.room.roomClass === "signature" ? "Signature" : "Haven"}</span>
        {promo && !busy ? <span className="bk-badge bk-badge-gold">{promo.name}</span> : null}
        {busy ? <span className="bk-busy-tag">{r.reasons[0]?.code === "TOO_MANY_GUESTS" ? `Tối đa ${r.room.maxGuests} khách` : "Vừa được đặt"}</span> : null}
      </div>
      <div className="bk-room-body">
        <div>
          <div className="bk-room-name">Phòng {r.room.roomNumber}</div>
          <div className="bk-room-meta">
            {[m.area ? `${m.area} m²` : null, m.bed || null, `tối đa ${r.room.maxGuests} khách`, `tầng ${r.room.floor}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        {r.price && !busy ? (
          <div className="bk-price">
            <strong>{vnd(total)}</strong>
            {promo ? <s>{vnd(r.price.subtotal + addonFee(r, addons))}</s> : null}
            {promo ? <em>−{vnd(promo.discount)}</em> : null}
          </div>
        ) : null}
        {a && !busy && (a.earlyCheckinOptions.length || a.lateCheckoutOptions.length) ? (
          <div className="bk-addons">
            <Chips label="Nhận phòng sớm" options={a.earlyCheckinOptions} value={addons.early} onPick={(h) => props.onAddons({ ...addons, early: h })} />
            <Chips label="Trả phòng muộn" options={a.lateCheckoutOptions} value={addons.late} onPick={(h) => props.onAddons({ ...addons, late: h })} />
          </div>
        ) : null}
        <button type="button" className={`bk-btn ${selected ? "bk-btn-primary" : "bk-btn-outline"} bk-btn-block`} disabled={busy} onClick={props.onSelect}>
          {busy ? "Vừa được đặt" : selected ? "Đã chọn ✓" : "Chọn phòng này"}
        </button>
      </div>
    </article>
  );
}
