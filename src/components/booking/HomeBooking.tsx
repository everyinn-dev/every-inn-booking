"use client";
/** Home page entry (LSB-4): the same search widget; "Tìm phòng trống" opens /dat-phong with the criteria. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criteriaToQuery, defaultNightDate, type SearchCriteria } from "@/shared/booking-kit/stay";
import type { Storefront } from "@/shared/booking-kit/types";
import { api } from "@/lib/booking/client";
import SearchBar from "./SearchBar";

export default function HomeBooking() {
  const router = useRouter();
  const [sf, setSf] = useState<Storefront | null>(null);
  const [off, setOff] = useState(false);
  const [c, setC] = useState<SearchCriteria>(() => ({ kind: "overnight", date: defaultNightDate(), guests: 2 }));
  useEffect(() => {
    api<Storefront>("GET", "/api/guest/storefront").then((r) => {
      if (r.ok && r.data) {
        setSf(r.data);
        setC((x) => ({ ...x, shift: x.shift ?? r.data!.overnight.shifts[1]?.code }));
      } else if (r.error?.code === "FEATURE_DISABLED") setOff(true);
    });
  }, []);
  if (off) return null;
  return (
    <section className="bk-home" id="dat-phong" aria-label="Đặt phòng online">
      <div className="container">
        <h2>Đặt phòng trong 1 phút</h2>
        <p className="bk-sub">Xem phòng trống ngay · Giữ phòng 10 phút · Xác nhận qua chuyển khoản</p>
        <SearchBar value={c} onChange={setC} storefront={sf} onSubmit={() => router.push(`/dat-phong?${criteriaToQuery(c)}`)} />
      </div>
    </section>
  );
}
