import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchPage from "@/components/booking/SearchPage";
import { webBookingEnabled } from "@/lib/server/bff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Đặt phòng | Every Inn – tự nhận phòng 24/7",
  description: "Xem phòng trống theo giờ, qua đêm hoặc theo ngày và giữ phòng 10 phút ngay trên web. Tự nhận phòng 24/7 tại Nguyễn Công Hoan.",
  alternates: { canonical: "/dat-phong" },
};

export default async function Page() {
  if (!(await webBookingEnabled())) notFound();
  return (
    <>
      <Header showSelfBooking={true} />
      <Suspense fallback={<main className="bk-page" />}>
        <SearchPage />
      </Suspense>
      <Footer showSelfBooking={true} />
    </>
  );
}
