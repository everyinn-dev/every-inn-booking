/**
 * Curated Google Maps reviews shown on the home page (hand-picked, not live).
 * Source: https://maps.app.goo.gl/KT6uebooCtsLT2dy7 — update rating/count when it changes.
 * Photos live in /public/reviews (downloaded copies; never hotlink googleusercontent).
 * Text is verbatim from the reviewer.
 */
export interface GoogleReview {
  name: string;
  stars: 5;
  text: string;
  photos: string[];
}

// MANUAL values, not realtime. `rating` drives the number, the partial-fill stars and the
// AggregateRating JSON-LD (HotelSchema); update rating/count together, then deploy.
export const GOOGLE_REVIEWS_SOURCE = {
  rating: 5.0,
  count: 31,
  url: 'https://maps.app.goo.gl/KT6uebooCtsLT2dy7',
} as const;

export const GOOGLE_REVIEWS: GoogleReview[] = [
  {
    name: 'dung phương',
    stars: 5,
    text:
      'Mình book home này khá ngẫu hứng qua Instagram thôi, nhưng đến nơi thì thật sự rất ưng. Phòng sạch sẽ, xinh y như hình, không gian thoải mái và tạo cảm giác rất dễ chịu.\n\nĐiểm mình thích nhất là admin và chủ home cực kỳ dễ thương, nhiệt tình, hỗ trợ nhanh và thân thiện nên trải nghiệm càng trọn vẹn hơn.\n\nTrộm vía tìm được một chỗ ở đáng yêu như vậy. Chắc chắn sẽ quay lại nếu có dịp! 🤍',
    photos: ['/reviews/dung-phuong-1.jpg', '/reviews/dung-phuong-2.jpg'],
  },
  {
    name: 'Ánh cEm',
    stars: 5,
    text:
      'Book bừa home trên ig sợ scam mà trúng ngay secret. 1 chiếc airbnb mới, sạch sẽ, admin nhiệt tình, tự check-in nhưng vẫn được hỗ trợ mang hành lý lên lầu vì thang bộ ấy. Điều hoà mát, máy chiếu nét, chăn ga thơm, dễ ngủ lắm🤣 Tiện đi lại, nhà trong hẻm nên không tiện ô tô vào thôi chứ xe máy vô tư. Sẽ qlai nếu có dịp vô SG',
    photos: ['/reviews/anh-cem-1.jpg', '/reviews/anh-cem-2.jpg'],
  },
  {
    name: 'Dánh Dánh',
    stars: 5,
    text:
      'mấy bà coi cái home nè, chỗ này giúp tui đẻ ra mấy tấm hình peak vi ci eo, chủ home siu nhiệt tình nha, ko có gì phải chê 🥹',
    photos: ['/reviews/danh-danh-1.jpg', '/reviews/danh-danh-2.jpg'],
  },
  {
    name: 'Hy Hoàng',
    stars: 5,
    text: 'Cái home peak vãi chưởng =)))) admin hơi bị cute, chủ home cũng nhiệt tình nữa, service tận răng ❤️',
    photos: ['/reviews/hy-hoang-1.jpg', '/reviews/hy-hoang-2.jpg'],
  },
  {
    name: 'Hà Đinh',
    stars: 5,
    text:
      'Phòng 301 ở tầng 3 nên hồi đầu mình hơi ngại đi leo cao nhưng cầu thang cũng dễ đi và anh chủ hỗ trợ khiêng vali nhiệt tình, phòng có bàn cao làm việc ok',
    photos: ['/reviews/ha-dinh-1.jpg', '/reviews/ha-dinh-2.jpg'],
  },
  {
    name: 'Hạ Nắng',
    stars: 5,
    text:
      'Chiếc home mới xinh iu làm sao! Phòng sạch, thơm, đủ đồ dùng, mạng mạnh, admin siêu nhiệt tình và hỗ trợ khách lun nàaa. Nhất định mình sẽ ghé lại!',
    photos: ['/reviews/ha-nang-1.jpg'],
  },
];
