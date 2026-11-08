import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CheckinPage from "@/components/checkin/CheckinPage";
import BookingDisabled from "@/components/booking/Disabled";
import { webBookingEnabled } from "@/lib/server/bff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tra cứu check-in | Every Inn", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page() {
  return (
    <>
      <Header />
      {(await webBookingEnabled()) ? (
        <Suspense fallback={<main className="bk-page" />}>
          <CheckinPage />
        </Suspense>
      ) : (
        <BookingDisabled />
      )}
      <Footer />
    </>
  );
}
