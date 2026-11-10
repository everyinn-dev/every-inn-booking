import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CheckinPage from "@/components/checkin/CheckinPage";
import { webBookingEnabled } from "@/lib/server/bff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tra cứu check-in | Every Inn", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page() {
  if (!(await webBookingEnabled())) notFound();
  return (
    <>
      <Header showSelfBooking={true} />
      <Suspense fallback={<main className="bk-page" />}>
        <CheckinPage />
      </Suspense>
      <Footer showSelfBooking={true} />
    </>
  );
}
