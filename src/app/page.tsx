import Header from '../components/Header';
import Hero from '../components/Hero';
import Rooms from '../components/Rooms';
import Pricing from '../components/Pricing';
import LoyaltyLookup from '../components/LoyaltyLookup';
import Location from '../components/Location';
import Footer from '../components/Footer';
import HomeBooking from '../components/booking/HomeBooking';
import { loyaltyEnabled, webBookingEnabled } from '../lib/server/bff';

export const dynamic = "force-dynamic";

export default async function Home() {
  const [bookingOn, loyaltyOn] = await Promise.all([webBookingEnabled(), loyaltyEnabled()]);
  return (
    <>
      <Header showSelfBooking={bookingOn} />
      <Hero />
      {/* LSB-4: omitted completely when WEB_BOOKING_ENABLED=false so prod guests see no self-booking UI */}
      {bookingOn && <HomeBooking />}
      <Rooms />
      <Pricing />
      {/* Loyalty lookup: interactive when LOYALTY_ENABLED=true (dev), Coming Soon teaser mode when false (prod). */}
      <LoyaltyLookup comingSoon={!loyaltyOn} />
      <Location />
      <Footer showSelfBooking={bookingOn} />
    </>
  );
}
