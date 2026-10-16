import Header from '../components/Header';
import Hero from '../components/Hero';
import Rooms from '../components/Rooms';
import Pricing from '../components/Pricing';
import LoyaltyLookup from '../components/LoyaltyLookup';
import Location from '../components/Location';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <Rooms />
      <Pricing />
      <LoyaltyLookup />
      <Location />
      <Footer />
    </>
  );
}
