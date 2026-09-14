import React from 'react';

export default function HotelSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['Hotel', 'LodgingBusiness'],
    '@id': 'https://everyinn.vn/#hotel',
    name: 'Every Inn - Apartments & Hotel',
    alternateName: [
      'Every Inn',
      'Every Inn Phú Nhuận',
      'Every Inn Nguyễn Công Hoan',
      'Every Inn Cầu Kiệu'
    ],
    description:
      'Every Inn – Căn hộ mini tối giản, tự nhận phòng 24/7 tại 69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu (Quận Phú Nhuận cũ), TP.HCM. Gần sân bay Tân Sơn Nhất. Combo 3H, 6H, Qua đêm, Phòng ngày từ 256.000đ.',
    url: 'https://everyinn.vn/',
    logo: 'https://res.cloudinary.com/gsldcdgb/image/upload/v1788681602/My%20Brand/LOGO_1_wbjveg.png',
    image: [
      'https://res.cloudinary.com/gsldcdgb/image/upload/c_fill,w_1200,h_630,q_80,f_auto/v1785586726/20_sc3x5z.jpg',
      'https://res.cloudinary.com/gsldcdgb/image/upload/c_fill,w_1920,h_1080,q_80,f_auto/v1785586463/36_iwxmar.jpg',
      'https://res.cloudinary.com/gsldcdgb/image/upload/v1785587031/102_wxxqae.jpg',
      'https://res.cloudinary.com/gsldcdgb/image/upload/v1785587029/101_t0zzks.jpg',
      'https://res.cloudinary.com/gsldcdgb/image/upload/v1785587029/201_mwm5gt.jpg',
      'https://res.cloudinary.com/gsldcdgb/image/upload/v1785586468/new_tyggz1.jpg'
    ],
    telephone: '+84906314109',
    email: 'hi.everyinn@gmail.com',
    priceRange: '256.000₫ - 750.000₫',
    currenciesAccepted: 'VND',
    paymentAccepted: 'Tiền mặt, Chuyển khoản ngân hàng (Bank Transfer)',
    checkinTime: '15:00',
    checkoutTime: '12:00',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '00:00',
        closes: '23:59',
      },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: '69/24L1 Nguyễn Công Hoan',
      addressLocality: 'Phường Cầu Kiệu',
      addressRegion: 'Thành phố Hồ Chí Minh',
      postalCode: '700000',
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 10.7998871,
      longitude: 106.6889157,
    },
    hasMap: 'https://maps.google.com/?cid=13693822161726077230',
    sameAs: [
      'https://www.instagram.com/everyinn.home/',
      'https://maps.google.com/?cid=13693822161726077230',
      'https://www.google.com/maps/place/Every+Inn+-+Apartments+%26+Hotel/@10.7998871,106.6889157,17z/data=!3m1!4b1!4m6!3m5!1s0x317529888f02f98b:0xbe09bebbc5faf92e!8m2!3d10.7998871!4d106.6889157',
    ],
    amenityFeature: [
      {
        '@type': 'LocationFeatureSpecification',
        name: 'Free Wi-Fi',
        value: true,
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: 'Air Conditioning',
        value: true,
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: '24-Hour Self Check-in / Smart Lock',
        value: true,
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: 'Smart TV (YouTube & Netflix)',
        value: true,
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: 'Mini Fridge',
        value: true,
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: 'Hair Dryer & Electric Kettle',
        value: true,
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: 'Private Bathroom & Fresh Towels',
        value: true,
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: 'Close to Tan Son Nhat Airport (~15 mins)',
        value: true,
      },
    ],
    containsPlace: [
      {
        '@type': 'HotelRoom',
        name: 'Haven Class (Phòng 101, 201, 301)',
        description:
          'Căn hộ mini 20m², giường đôi Queen, tự nhận phòng 24/7 bằng mã khóa thông minh, gần sân bay Tân Sơn Nhất.',
        occupancy: {
          '@type': 'QuantitativeValue',
          value: 2,
          unitCode: 'C62',
        },
        floorSize: {
          '@type': 'QuantitativeValue',
          value: 20,
          unitCode: 'MTK',
        },
        bed: {
          '@type': 'BedDetails',
          numberOfBeds: 1,
          typeOfBed: 'Queen Bed',
        },
        offers: [
          {
            '@type': 'Offer',
            name: 'Combo 3 Giờ - Haven',
            price: '320000',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
            url: 'https://everyinn.vn/#pricing',
          },
          {
            '@type': 'Offer',
            name: 'Combo 6 Giờ - Haven',
            price: '600000',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
            url: 'https://everyinn.vn/#pricing',
          },
          {
            '@type': 'Offer',
            name: 'Qua Đêm (21:00 - 09:00) - Haven',
            price: '490000',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
            url: 'https://everyinn.vn/#pricing',
          },
          {
            '@type': 'Offer',
            name: 'Phòng Ngày (15:00 - 12:00) - Haven',
            price: '590000',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
            url: 'https://everyinn.vn/#pricing',
          },
        ],
      },
      {
        '@type': 'HotelRoom',
        name: 'Signature Class (Phòng 102, 202, 302)',
        description:
          'Căn hộ mini 28-30m², hai mặt cửa sổ thoáng sáng, giường đôi nệm cao cấp, tự nhận phòng 24/7.',
        occupancy: {
          '@type': 'QuantitativeValue',
          value: 2,
          unitCode: 'C62',
        },
        floorSize: {
          '@type': 'QuantitativeValue',
          value: 30,
          unitCode: 'MTK',
        },
        bed: {
          '@type': 'BedDetails',
          numberOfBeds: 1,
          typeOfBed: 'Queen Bed',
        },
        offers: [
          {
            '@type': 'Offer',
            name: 'Combo 3 Giờ - Signature',
            price: '360000',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
            url: 'https://everyinn.vn/#pricing',
          },
          {
            '@type': 'Offer',
            name: 'Combo 6 Giờ - Signature',
            price: '640000',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
            url: 'https://everyinn.vn/#pricing',
          },
          {
            '@type': 'Offer',
            name: 'Qua Đêm (21:00 - 09:00) - Signature',
            price: '620000',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
            url: 'https://everyinn.vn/#pricing',
          },
          {
            '@type': 'Offer',
            name: 'Phòng Ngày (15:00 - 12:00) - Signature',
            price: '750000',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01',
            url: 'https://everyinn.vn/#pricing',
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
