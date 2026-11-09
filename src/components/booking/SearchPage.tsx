"use client";
/**
 * /dat-phong — search → results → pick a room (+ add-on hours) → "Giữ phòng 10 phút".
 * Realtime: the availability pulse (agent-core InventoryPulse DO, long-poll) re-runs the search silently when any
 * channel books / releases a room; changed cards flash. Search state lives in the URL (shareable links).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { criteriaToQuery, queryToCriteria, type SearchCriteria } from "@/shared/booking-kit/stay";
import { dateLabel, stayLabel, timeOf, vnd } from "@/shared/booking-kit/format";
import { useLongPoll } from "@/shared/booking-kit/live";
import type { SearchResult, Storefront } from "@/shared/booking-kit/types";
import { api, newNonce, readActiveHold, writeActiveHold, type ActiveHold } from "@/lib/booking/client";
import SearchBar from "./SearchBar";
import RoomResultCard, { displayTotal, type Addons } from "./RoomResultCard";
import PhoneHoldModal, { type HoldConflict } from "./PhoneHoldModal";

type Result = SearchResult & { criteria: SearchCriteria; shift: string | null };

export default function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [criteria, setCriteria] = useState<SearchCriteria>(() => queryToCriteria(new URLSearchParams(params.toString())));
  const [sf, setSf] = useState<Storefront | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(params.get("phong"));
  const [addons, setAddons] = useState<Record<string, Addons>>({});
  const [holding, setHolding] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<ActiveHold | null>(null);
  const prevAvail = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    setActive(readActiveHold());
    try {
      const ch = new BroadcastChannel("ei-booking");
      ch.onmessage = () => setActive(readActiveHold());
      return () => ch.close();
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    api<Storefront>("GET", "/api/guest/storefront").then((r) => {
      if (r.ok && r.data) {
        setSf(r.data);
        setCriteria((c) => (c.kind === "overnight" && !c.shift ? { ...c, shift: r.data!.overnight.shifts[1]?.code } : c));
      } else setError(r.error?.message ?? null);
    });
  }, []);

  const search = useCallback(
    async (c: SearchCriteria, opts: { silent?: boolean } = {}) => {
      if (c.kind === "hourly" && !c.start) return;
      if (!opts.silent) {
        setLoading(true);
        setError(null);
      }
      const r = await api<Result>("POST", "/api/guest/availability", c);
      if (!opts.silent) setLoading(false);
      if (!r.ok || !r.data) {
        if (!opts.silent) {
          setError(r.error?.message ?? "Chưa tìm được phòng, bạn thử lại nhé.");
          setResult(null);
        }
        return;
      }
      const changed = new Set<string>();
      for (const room of r.data.rooms) {
        const before = prevAvail.current.get(room.room.id);
        if (opts.silent && before !== undefined && before !== room.available) changed.add(room.room.id);
        prevAvail.current.set(room.room.id, room.available);
      }
      if (changed.size) {
        setFresh(changed);
        setTimeout(() => setFresh(new Set()), 1800);
        if (selected && changed.has(selected) && !r.data.rooms.find((x) => x.room.id === selected)?.available) {
          setSelected(null);
          setToast("Phòng bạn chọn vừa có khách khác giữ — chọn phòng khác nhé.");
        }
      }
      setResult(r.data);
    },
    [selected],
  );

  // first search once the storefront (shifts, window) is known
  const started = useRef(false);
  useEffect(() => {
    if (!sf || started.current) return;
    started.current = true;
    search(criteria);
  }, [sf, criteria, search]);

  const submit = () => {
    router.replace(`${pathname}?${criteriaToQuery(criteria)}`, { scroll: false });
    setSelected(null);
    setAddons({});
    prevAvail.current = new Map();
    search(criteria);
  };

  // realtime availability (pulse) → silent re-search
  const pulse = useLongPoll<{ version: number }>({
    url: (v) => (result ? `/api/guest/pulse?v=${v}` : null),
    initial: null,
    pick: (b) => ((b as { data?: { version: number } }).data ? { version: (b as { data: { version: number } }).data.version } : null),
    enabled: !!result,
  });
  const lastPulse = useRef(0);
  useEffect(() => {
    const v = pulse.data?.version ?? 0;
    if (!result || v === 0) return;
    if (lastPulse.current && v > lastPulse.current) search(result.criteria, { silent: true });
    lastPulse.current = v;
  }, [pulse.data, result, search]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const rooms = useMemo(() => {
    if (!result) return [];
    return [...result.rooms].sort((a, b) => Number(b.available) - Number(a.available));
  }, [result]);
  const chosen = rooms.find((r) => r.room.id === selected && r.available) ?? null;
  const chosenAddons = (chosen && addons[chosen.room.id]) || { early: 0, late: 0 };

  const handleHoldConfirm = async (phone: string, forceSwitch = false): Promise<{ ok: boolean; conflict?: HoldConflict; error?: string }> => {
    if (!chosen || !result) return { ok: false, error: "Chưa chọn phòng." };
    setHolding(true);
    const r = await api<{ token: string; session: { room: { label: string }; expiresAt: string } }>("POST", "/api/guest/sessions", {
      ...result.criteria,
      roomId: chosen.room.id,
      early: chosenAddons.early,
      late: chosenAddons.late,
      phone,
      ...(forceSwitch ? { forceSwitch: true } : {}),
      clientNonce: newNonce(),
    });
    setHolding(false);
    if (r.ok && r.data) {
      writeActiveHold({ token: r.data.token, roomLabel: r.data.session.room.label, expiresAt: r.data.session.expiresAt });
      router.push(`/dat-phong/${r.data.token}`);
      return { ok: true };
    }
    if (r.error?.code === "ANOTHER_SESSION_LIVE" && r.error.details) {
      const d = r.error.details as { existingRoomLabel?: string; remainingSeconds?: number };
      return {
        ok: false,
        conflict: {
          existingRoomLabel: d.existingRoomLabel ?? "phòng khác",
          remainingSeconds: Number(d.remainingSeconds ?? 600),
        },
      };
    }
    setToast(r.error?.message ?? "Chưa giữ được phòng, bạn thử lại nhé.");
    if (r.error?.code === "AVAILABILITY_CHANGED" || r.status === 409) {
      setSelected(null);
      search(result.criteria, { silent: true });
    }
    return { ok: false, error: r.error?.message ?? "Chưa giữ được phòng, bạn thử lại nhé." };
  };

  const stayText = result
    ? result.criteria.kind === "dayuse"
      ? `${dateLabel(result.criteria.date)} → ${dateLabel(result.criteria.out ?? result.criteria.date)}`
      : `${timeOf(result.checkinAt)} ${dateLabel(result.criteria.date)} → ${timeOf(result.checkoutAt)}`
    : "";

  return (
    <main className="bk-page">
      <div className="bk-wrap">
        <h1 className="bk-title">Đặt phòng Every Inn</h1>
        <p className="bk-sub">Tự nhận phòng 24/7 · Xác nhận ngay khi Home nhận chuyển khoản</p>
        {active ? (
          <div className="bk-banner bk-banner-info" style={{ marginTop: 12 }}>
            <span>
              Bạn đang giữ <b>{active.roomLabel}</b>.{" "}
              <Link className="bk-link" href={`/dat-phong/${active.token}`}>
                Tiếp tục đặt
              </Link>
            </span>
          </div>
        ) : null}
        <div className="bk-search-layout" style={{ marginTop: 16 }}>
          <SearchBar value={criteria} onChange={setCriteria} onSubmit={submit} storefront={sf} shiftSummary={result?.shiftSummary} busy={loading} />
          <section aria-live="polite">
            {error ? (
              <div className="bk-banner bk-banner-danger bk-results-head">{error}</div>
            ) : null}
            {result ? (
              <div className="bk-results-head bk-between">
                <div>
                  <div className="bk-strong">
                    {rooms.filter((r) => r.available).length} phòng trống · {stayText}
                  </div>
                  <div className="bk-small bk-muted">
                    {stayLabel({ bookingType: result.criteria.kind, shift: result.shift, checkinAt: result.checkinAt, checkoutAt: result.checkoutAt })} · {result.criteria.guests} khách
                    {!pulse.online ? " · đang kết nối lại…" : ""}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="bk-results">
              {loading && !result ? [0, 1, 2].map((i) => <div key={i} className="bk-skeleton" aria-hidden />) : null}
              {rooms.map((r) => (
                <RoomResultCard
                  key={r.room.id}
                  room={r}
                  fresh={fresh.has(r.room.id)}
                  selected={selected === r.room.id}
                  addons={addons[r.room.id] ?? { early: 0, late: 0 }}
                  onAddons={(a) => {
                    setAddons((m) => ({ ...m, [r.room.id]: a }));
                    setSelected(r.room.id);
                  }}
                  onSelect={() => setSelected(selected === r.room.id ? null : r.room.id)}
                />
              ))}
            </div>
            {result && rooms.every((r) => !r.available) ? (
              <div className="bk-card bk-empty" style={{ marginTop: 12 }}>
                <p className="bk-strong">Khung giờ này đã kín phòng</p>
                <p className="bk-sub">Thử ca khác, ngày khác — hoặc nhắn Home để được gợi ý.</p>
                <a className="bk-btn bk-btn-outline" style={{ marginTop: 12 }} href="https://www.instagram.com/everyinn.home/" target="_blank" rel="noopener noreferrer">
                  Nhắn Home qua Instagram
                </a>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {chosen ? (
        <div className="bk-bar">
          <div className="bk-bar-inner">
            <div className="bk-bar-info">
              <strong>{vnd(displayTotal(chosen, chosenAddons))}</strong>
              <span>
                Phòng {chosen.room.roomNumber}
                {chosenAddons.early ? ` · +${chosenAddons.early}h sớm` : ""}
                {chosenAddons.late ? ` · +${chosenAddons.late}h muộn` : ""} · tạm tính
              </span>
            </div>
            <button type="button" className="bk-btn bk-btn-primary" onClick={() => setShowPhoneModal(true)} disabled={holding}>
              {holding ? "Đang giữ…" : "Giữ phòng 10 phút"}
            </button>
          </div>
        </div>
      ) : null}
      <PhoneHoldModal
        open={showPhoneModal}
        room={chosen}
        addons={chosenAddons}
        staySubtitle={result ? stayLabel({ bookingType: result.criteria.kind, shift: result.shift, checkinAt: result.checkinAt, checkoutAt: result.checkoutAt }) : ""}
        total={chosen ? displayTotal(chosen, chosenAddons) : 0}
        onClose={() => setShowPhoneModal(false)}
        onConfirm={handleHoldConfirm}
      />
      {toast ? (
        <div className="bk-toast" role="status">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
