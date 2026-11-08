"use client";
/**
 * LSB-4 search widget (Agoda / Airbnb mobile-first): 3 tabs — Theo giờ · Qua đêm (4 ca) · Theo ngày.
 * Dates beyond the rolling advance window are disabled (storefront.bookingWindow.maxDate, rolls at 00:00 VN).
 */
import { useMemo } from "react";
import { addDays, hourlyStarts, isSmallHours, todayVn, type SearchCriteria, type StayKind } from "@/shared/booking-kit/stay";
import { dateLabel } from "@/shared/booking-kit/format";
import type { SearchResult, Storefront } from "@/shared/booking-kit/types";

const TABS: { kind: StayKind; label: string }[] = [
  { kind: "hourly", label: "Theo giờ" },
  { kind: "overnight", label: "Qua đêm" },
  { kind: "dayuse", label: "Theo ngày" },
];

function quickDays(today: string): { date: string; label: string }[] {
  const d = new Date(`${today}T00:00:00+07:00`);
  const dow = new Date(d.getTime() + 7 * 3_600_000).getUTCDay();
  const toSat = (6 - dow + 7) % 7;
  const list = [
    { date: today, label: "Hôm nay" },
    { date: addDays(today, 1), label: "Ngày mai" },
  ];
  if (toSat > 1) list.push({ date: addDays(today, toSat), label: "Thứ 7 này" });
  return list;
}

export default function SearchBar(props: {
  value: SearchCriteria;
  onChange: (c: SearchCriteria) => void;
  onSubmit?: () => void;
  storefront: Storefront | null;
  shiftSummary?: SearchResult["shiftSummary"];
  submitLabel?: string;
  busy?: boolean;
}) {
  const { value: c, onChange, storefront: sf } = props;
  const today = sf?.bookingWindow.today ?? todayVn();
  const maxDate = sf?.bookingWindow.maxDate ?? addDays(today, 90);
  const set = (patch: Partial<SearchCriteria>) => onChange({ ...c, ...patch });
  const minDate = c.kind === "overnight" && isSmallHours() ? addDays(today, -1) : today;
  const starts = useMemo(
    () => (sf ? hourlyStarts(c.date, sf.hourly.firstCheckin, sf.hourly.lastCheckin, sf.bookingWindow.minLeadMinutes) : []),
    [sf, c.date],
  );
  const summary = new Map((props.shiftSummary ?? []).map((s) => [s.code, s]));
  const maxGuests = 4;

  return (
    <form
      className="bk-search"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit?.();
      }}
      aria-label="Tìm phòng trống"
    >
      <div className="bk-tabs" role="tablist" aria-label="Hình thức thuê">
        {TABS.map((t) => (
          <button
            key={t.kind}
            type="button"
            role="tab"
            className="bk-tab"
            aria-selected={c.kind === t.kind}
            onClick={() => set({ kind: t.kind, ...(t.kind === "dayuse" && (!c.out || c.out <= c.date) ? { out: addDays(c.date, 1) } : {}) })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="bk-field">
        <span className="bk-field-label">{c.kind === "overnight" ? "Đêm lưu trú" : c.kind === "dayuse" ? "Ngày nhận phòng" : "Ngày"}</span>
        <div className="bk-chips" role="group" aria-label="Chọn nhanh ngày">
          {quickDays(today).map((q) => (
            <button key={q.date} type="button" className="bk-chip" aria-pressed={c.date === q.date} onClick={() => set({ date: q.date, ...(c.kind === "dayuse" && (!c.out || c.out <= q.date) ? { out: addDays(q.date, 1) } : {}) })}>
              {q.label}
            </button>
          ))}
        </div>
        <input
          className="bk-input"
          style={{ marginTop: 8 }}
          type="date"
          value={c.date}
          min={minDate}
          max={maxDate}
          onChange={(e) => e.target.value && set({ date: e.target.value, ...(c.kind === "dayuse" && (!c.out || c.out <= e.target.value) ? { out: addDays(e.target.value, 1) } : {}) })}
          aria-label="Chọn ngày"
        />
        {c.kind === "overnight" && isSmallHours() && c.date === addDays(today, -1) ? (
          <p className="bk-help">Bạn đang chọn đêm {dateLabel(c.date)} — nhận phòng ngay trong rạng sáng nay. Muốn đêm nay ({dateLabel(today)}) thì chọn “Hôm nay”.</p>
        ) : null}
      </label>

      {c.kind === "overnight" && sf ? (
        <div className="bk-field">
          <span className="bk-field-label">Ca qua đêm (12 tiếng)</span>
          <div className="bk-shifts" role="group" aria-label="Ca qua đêm">
            {sf.overnight.shifts.map((s) => {
              const sum = summary.get(s.code);
              const full = sum ? sum.availableRooms === 0 : false;
              return (
                <button key={s.code} type="button" className="bk-shift" aria-pressed={(c.shift ?? sf.overnight.shifts[1]?.code) === s.code} data-full={full} disabled={sum?.past} onClick={() => set({ shift: s.code })}>
                  <strong>{s.label}</strong>
                  <span>{sum ? (sum.past ? "Đã qua giờ" : full ? "Hết phòng" : `Còn ${sum.availableRooms} phòng`) : `${s.start} → ${s.end}`}</span>
                </button>
              );
            })}
          </div>
          <p className="bk-help">Nhận sớm / trả muộn thêm giờ (60.000đ/giờ) chọn ngay trên thẻ phòng.</p>
        </div>
      ) : null}

      {c.kind === "hourly" ? (
        <div className="bk-grid-2">
          <label className="bk-field">
            <span className="bk-field-label">Giờ nhận phòng</span>
            <select className="bk-select" value={c.start ?? ""} onChange={(e) => set({ start: e.target.value })}>
              <option value="" disabled>
                {starts.length ? "Chọn giờ" : "Hết giờ hôm nay"}
              </option>
              {starts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="bk-field">
            <span className="bk-field-label">Thời lượng</span>
            <div className="bk-stepper">
              <button type="button" aria-label="Bớt 1 giờ" disabled={(c.hours ?? 3) <= (sf?.hourly.minHours ?? 3)} onClick={() => set({ hours: (c.hours ?? 3) - 1 })}>
                −
              </button>
              <output>{c.hours ?? 3} giờ</output>
              <button type="button" aria-label="Thêm 1 giờ" disabled={(c.hours ?? 3) >= 12} onClick={() => set({ hours: (c.hours ?? 3) + 1 })}>
                +
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {c.kind === "dayuse" ? (
        <>
          <label className="bk-field">
            <span className="bk-field-label">Ngày trả phòng</span>
            <input className="bk-input" type="date" value={c.out ?? addDays(c.date, 1)} min={addDays(c.date, 1)} max={addDays(maxDate, 1)} onChange={(e) => e.target.value && set({ out: e.target.value })} />
          </label>
          <p className="bk-note">
            Nhận phòng <b>{sf?.dayuse.checkin ?? "15:00"}</b> · Trả phòng <b>{sf?.dayuse.checkout ?? "12:00"}</b> trưa hôm sau
          </p>
        </>
      ) : null}

      <div className="bk-field">
        <span className="bk-field-label">Số khách</span>
        <div className="bk-stepper">
          <button type="button" aria-label="Bớt 1 khách" disabled={c.guests <= 1} onClick={() => set({ guests: c.guests - 1 })}>
            −
          </button>
          <output>
            {c.guests} khách{c.guests > 2 ? " · chỉ phòng Signature" : ""}
          </output>
          <button type="button" aria-label="Thêm 1 khách" disabled={c.guests >= maxGuests} onClick={() => set({ guests: c.guests + 1 })}>
            +
          </button>
        </div>
      </div>

      {props.onSubmit ? (
        <button type="submit" className="bk-btn bk-btn-primary bk-btn-block" disabled={props.busy || (c.kind === "hourly" && !c.start)}>
          {props.busy ? "Đang tìm…" : (props.submitLabel ?? "Tìm phòng trống")}
        </button>
      ) : null}
    </form>
  );
}
