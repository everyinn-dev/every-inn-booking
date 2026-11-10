import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import CheckoutPage from "@/components/booking/CheckoutPage";
import { bffEnv, TOKEN_RE, webBookingEnabled } from "@/lib/server/bff";
import type { SessionView } from "@/shared/booking-kit/types";

export const dynamic = "force-dynamic";
// the token is a capability: never index, never leak through Referer
export const metadata: Metadata = { title: "Giữ phòng | Every Inn", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function initialSession(token: string): Promise<SessionView | null> {
  if (!TOKEN_RE.test(token)) return null;
  const env = await bffEnv();
  if (!env.AGENT_CORE) return null;
  try {
    const res = await env.AGENT_CORE.fetch(new Request(`https://agent-core.internal/internal/v1/web/sessions/${token}`, { headers: { "x-ei-caller": "landing-bff", accept: "application/json" } }));
    if (!res.ok) return null;
    return ((await res.json()) as { session: SessionView }).session;
  } catch {
    return null;
  }
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await webBookingEnabled())) notFound();
  const initial = await initialSession(token);
  return (
    <>
      <Header showSelfBooking={true} />
      <CheckoutPage token={token} initial={initial} />
    </>
  );
}
