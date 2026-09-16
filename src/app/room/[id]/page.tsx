import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import RoomCarousel from '../../../components/RoomCarousel';
import TikTokEmbed from '../../../components/TikTokEmbed';
import RoomBookingWidget from '../../../components/RoomBookingWidget';
import RoomCard from '../../../components/RoomCard';
import { AreaIcon, GuestsIcon, FloorIcon, BedIcon, CheckIcon } from '../../../components/Icons';
import { ROOMS, getRoomById, getRoomsByClass } from '../../../data/rooms';
import { getEffectivePrices, getCheapestPrice, PRICE_MANAGER, fmtVND } from '../../../data/pricing';

export async function generateStaticParams() {
  return ROOMS.map((room) => ({
    id: room.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const room = getRoomById(id);

  if (!room) {
    return {
      title: 'Không tìm thấy phòng | Every Inn',
    };
  }

  const title = `${room.name} | Every Inn – Nguyễn Công Hoan, P.Cầu Kiệu, TP.HCM`;
  const description = `${room.name} – ${room.shortDesc} Căn hộ mini tự nhận phòng 24/7 gần sân bay Tân Sơn Nhất. Combo 3H, 6H, Qua đêm, Phòng ngày.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/room/${room.id}`,
    },
    openGraph: {
      title,
      description,
      url: `https://everyinn.vn/room/${room.id}`,
      images: [
        {
          url: room.images.hero,
          width: 1080,
          height: 1350,
          alt: `${room.name} – Every Inn`,
        },
      ],
      type: 'website',
      locale: 'vi_VN',
      siteName: 'Every Inn',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [room.images.hero],
    },
  };
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = getRoomById(id);

  if (!room) {
    notFound();
  }

  const relatedRooms = getRoomsByClass(room.class).filter((r) => r.id !== room.id);
  const pricing = getEffectivePrices(room.priceClass);
  const carouselImages = room.images.gallery?.length ? room.images.gallery : [room.images.hero];

  const roomSchema = {
    '@context': 'https://schema.org',
    '@type': 'HotelRoom',
    name: room.name,
    description: `${room.shortDesc} Tại 69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu (Quận Phú Nhuận cũ), TP.HCM.`,
    image: room.images.hero,
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: room.guests,
    },
    floorSize: {
      '@type': 'QuantitativeValue',
      value: room.area,
      unitCode: 'MTK',
    },
    bed: {
      '@type': 'BedDetails',
      typeOfBed: room.bedType,
    },
    amenityFeature: room.amenities.map((a) => ({
      '@type': 'LocationFeatureSpecification',
      name: a.label,
      value: true,
    })),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'VND',
      price: pricing.prices.overnight,
      availability: 'https://schema.org/InStock',
      url: `https://everyinn.vn/room/${room.id}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(roomSchema) }}
      />

      <Header />

      <main id="room-detail-main">
        {/* Breadcrumb */}
        <nav className="breadcrumb" aria-label="Đường dẫn trang">
          <div className="container">
            <ul>
              <li>
                <Link href="/">Trang chủ</Link>
              </li>
              <li>
                <Link href={`/#class-${room.class.toLowerCase()}`}>{room.class}</Link>
              </li>
              <li aria-current="page">{room.name}</li>
            </ul>
          </div>
        </nav>

        {/* Room Header */}
        <section className="room-detail-header">
          <div className="container">
            <span className="class-tag">{room.class}</span>
            <h1>{room.name}</h1>
            <div className="room-detail-meta">
              <span>
                <AreaIcon /> {room.area}m²
              </span>
              <span>
                <GuestsIcon /> {room.guests} Khách
              </span>
              <span>
                <BedIcon /> {room.bedType}
              </span>
              <span>
                <FloorIcon /> Tầng {room.floor}
              </span>
            </div>
          </div>
        </section>

        {/* Image Carousel */}
        <RoomCarousel images={carouselImages} roomName={room.name} />

        {/* Detail Content & Booking Sidebar */}
        <section className="room-detail-content">
          <div className="container room-layout">
            <div className="left-content">
              <div className="content-block">
                <h2>Mô tả phòng</h2>
                {room.description.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              <div className="content-block">
                <h2>Tiện nghi phòng</h2>
                <div className="amenities-grid">
                  {room.amenities.map((item, i) => (
                    <div key={i} className="amenity-item">
                      <CheckIcon />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Media section: TikTok & Video */}
              {(room.videoUrl || room.tiktokEmbed) && (
                <section className="media-section">
                  <h2>Video &amp; Không gian thực tế</h2>
                  <div
                    className="media-grid"
                    style={{
                      gridTemplateColumns: room.videoUrl && room.tiktokEmbed ? undefined : '1fr',
                    }}
                  >
                    {room.videoUrl && (
                      <div className="video-container">
                        <iframe
                          src={room.videoUrl}
                          title={`Video không gian ${room.name}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {room.tiktokEmbed && <TikTokEmbed embedHtml={room.tiktokEmbed} />}
                  </div>
                </section>
              )}
            </div>

            <RoomBookingWidget priceClass={room.priceClass} />
          </div>
        </section>

        {/* Related Rooms */}
        {relatedRooms.length > 0 && (
          <section className="related-rooms" aria-label={`Phòng cùng hạng ${room.class}`}>
            <div className="container">
              <h2>Phòng cùng hạng {room.class}</h2>
              <div
                className="room-grid"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
              >
                {relatedRooms.map((relRoom) => (
                  <RoomCard key={relRoom.id} room={relRoom} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
