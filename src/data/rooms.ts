/**
 * data/rooms.ts
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for Every Inn room data.
 * To update a room: edit its entry here.
 * Pricing is controlled separately in data/pricing.ts.
 * ─────────────────────────────────────────────────────────────
 */

import { RoomClassKey } from './pricing';

// ── Cloudinary configuration ─────────────────────────────────
const CDN_BASE = 'https://res.cloudinary.com/gsldcdgb/image/upload';

export const cdn = (path: string, tx: string = '') => {
  if (!path) return '';
  const match = path.match(/image\/upload\/(.*)$/);
  const relPath = match ? match[1] : path.replace(/^\//, '');
  return tx ? `${CDN_BASE}/${tx}/${relPath}` : `${CDN_BASE}/${relPath}`;
};

export const LOGO_URL = 'https://res.cloudinary.com/gsldcdgb/image/upload/v1788681602/My%20Brand/LOGO_1_wbjveg.png';

// ── Image library ─────────────────────────────────────────────
export const ROOM_IMAGES = {
  r101: [
    'v1785587029/101_t0zzks.jpg',
    'v1785586719/10_p2exbl.jpg',
    'v1785586716/8_higuue.jpg',
    'v1785586715/9_lslplx.jpg',
  ],
  r102: [
    'v1785587031/102_wxxqae.jpg',
    'v1785586738/31_vs7ujv.png',
    'v1785586737/33_t5ygir.png',
    'v1785586735/32_got5uc.png',
    'v1785586731/21_jhgkki.jpg',
    'v1785586729/24_sfsork.jpg',
    'v1785586729/22_wnvebn.jpg',
    'v1785586726/20_sc3x5z.jpg',
  ],
  r201: [
    'v1785587029/201_mwm5gt.jpg',
    'v1785586719/11_vvd21z.jpg',
    'v1785586718/12_zgaln2.jpg',
  ],
  r202: [
    'v1785586468/new_tyggz1.jpg',
    'v1785586467/33_jambf1.jpg',
    'v1785586468/27_lqzefu.jpg',
    'v1785586734/30_t0btcs.jpg',
  ],
  r301: [
    'v1785587031/301_nzykxw.jpg',
    'v1785586717/6_nr2oqe.jpg',
    'v1785586715/4_b1qbdo.jpg',
    'v1785586714/7_arw0ue.jpg',
  ],
  r302: [
    'v1785587031/302_ilj56i.jpg',
    'v1785586733/13_qkd1r9.jpg',
    'v1785586725/16_hpwlke.jpg',
    'v1785586725/18_txlaru.jpg',
    'v1785586723/19_pwu1l1.jpg',
    'v1785586721/15_oqyhu1.jpg',
    'v1785586724/14_b8l9ak.jpg',
  ],
};

const makeImages = (paths: string | string[]) => {
  const arr = Array.isArray(paths) ? paths : [paths];
  const first = arr[0] || '';
  return {
    thumbnail: cdn(first, 'c_fill,w_1080,h_1350,q_80,f_auto'),
    hero:      cdn(first, 'c_fill,w_1080,h_1350,q_80,f_auto'),
    gallery:   arr.map((p) => cdn(p, 'c_fill,w_1080,h_1350,q_80,f_auto')),
  };
};

export interface RoomInfo {
  id: string;
  class: string;
  priceClass: RoomClassKey;
  roomNumber: string;
  name: string;
  area: number;
  guests: number;
  bedType: string;
  floor: number;
  shortDesc: string;
  description: string[];
  amenities: { icon: string; label: string }[];
  images: ReturnType<typeof makeImages>;
  videoUrl: string;
  tiktokEmbed: string;
}

// ── Room data ─────────────────────────────────────────────────
export const ROOMS: RoomInfo[] = [

  // ══════════════════════════════════════════════════════════
  //  SIGNATURE CLASS  (102 · 202 · 302)
  // ══════════════════════════════════════════════════════════
  {
    id: 'signature-102',
    class: 'Signature',
    priceClass: 'signature',
    roomNumber: '102',
    name: 'Signature 102',
    area: 28,
    guests: 2,
    bedType: 'Giường Đôi',
    floor: 1,
    shortDesc: 'Phòng góc tầng 1, hai mặt cửa sổ, đón ánh sáng từ sáng sớm.',
    description: [
      'Signature 102 là phòng góc tầng 1 — hai mặt cửa sổ đón ánh sáng tự nhiên từ hai hướng. Nằm ngay trong hẻm yên tĩnh tại Nguyễn Công Hoan, phòng mang lại sự tĩnh lặng hiếm có giữa lòng Sài Gòn.',
      'Không gian được thiết kế tối giản nhưng có chiều sâu: giường đôi nệm cao cấp, ga trắng tinh, hệ thống đèn ấm và những chi tiết nhỏ được chọn lọc kỹ để bạn thật sự nghỉ ngơi — không phải chỉ "ngủ lại".',
    ],
    amenities: [
      { icon: 'tv',     label: 'Smart TV' },
      { icon: 'wifi',   label: 'Wifi tốc độ cao' },
      { icon: 'ac',     label: 'Điều hoà inverter' },
      { icon: 'fridge', label: 'Tủ lạnh mini' },
      { icon: 'kettle', label: 'Ấm đun nước' },
      { icon: 'dryer',  label: 'Máy sấy tóc' },
      { icon: 'bath',   label: 'Dầu gội & Sữa tắm' },
      { icon: 'key',    label: 'Tự nhận phòng 24/7' },
    ],
    images: makeImages(ROOM_IMAGES.r102),
    videoUrl: '', 
    tiktokEmbed: '',
  },

  {
    id: 'signature-202',
    class: 'Signature',
    priceClass: 'signature',
    roomNumber: '202',
    name: 'Signature 202',
    area: 30,
    guests: 2,
    bedType: 'Giường Đôi',
    floor: 2,
    shortDesc: 'Tầng 2, cửa sổ lớn hướng trước — view thoáng, phòng rộng nhất dòng Signature.',
    description: [
      'Signature 202 nằm ở tầng 2 với cửa sổ lớn hướng ra phía trước, đón cả nắng sáng lẫn gió chiều. Đây là một trong những phòng được đặt nhiều nhất tại Every Inn — nhờ không gian rộng 30m² và tầm nhìn thoáng mà vẫn đủ riêng tư.',
      'Mọi thứ trong phòng đều được kiểm soát — từ độ cứng của nệm đến màu ánh đèn đọc sách — để đảm bảo bạn có giấc ngủ tốt nhất, dù đây là điểm dừng chân một đêm hay kỳ nghỉ dài ngày.',
    ],
    amenities: [
      { icon: 'tv',     label: 'Smart TV' },
      { icon: 'wifi',   label: 'Wifi tốc độ cao' },
      { icon: 'ac',     label: 'Điều hoà inverter' },
      { icon: 'fridge', label: 'Tủ lạnh mini' },
      { icon: 'kettle', label: 'Ấm đun nước' },
      { icon: 'dryer',  label: 'Máy sấy tóc' },
      { icon: 'bath',   label: 'Dầu gội & Sữa tắm' },
      { icon: 'key',    label: 'Tự nhận phòng 24/7' },
    ],
    images: makeImages(ROOM_IMAGES.r202),
    videoUrl: '', 
    tiktokEmbed: '',
  },

  {
    id: 'signature-302',
    class: 'Signature',
    priceClass: 'signature',
    roomNumber: '302',
    name: 'Signature 302',
    area: 30,
    guests: 2,
    bedType: 'Giường Đôi',
    floor: 3,
    shortDesc: 'Tầng cao nhất, yên tĩnh tuyệt đối — dành cho ai thực sự cần nghỉ ngơi.',
    description: [
      'Signature 302 là đỉnh cao của dòng Signature. Vị trí tầng 3 mang lại sự yên tĩnh vượt trội so với các phòng bên dưới — không tiếng ồn từ đường, không rung chấn từ hẻm. Chỉ có ánh sáng buổi sáng tràn qua cửa sổ lớn và tĩnh lặng.',
      'Lựa chọn lý tưởng cho những ai về sau chuyến bay đêm từ Tân Sơn Nhất, cần phục hồi năng lượng hoàn toàn trước một ngày mới dài.',
    ],
    amenities: [
      { icon: 'tv',     label: 'Smart TV' },
      { icon: 'wifi',   label: 'Wifi tốc độ cao' },
      { icon: 'ac',     label: 'Điều hoà inverter' },
      { icon: 'fridge', label: 'Tủ lạnh mini' },
      { icon: 'kettle', label: 'Ấm đun nước' },
      { icon: 'dryer',  label: 'Máy sấy tóc' },
      { icon: 'bath',   label: 'Dầu gội & Sữa tắm' },
      { icon: 'key',    label: 'Tự nhận phòng 24/7' },
    ],
    images: makeImages(ROOM_IMAGES.r302),
    videoUrl: '', 
    tiktokEmbed: '',
  },

  // ══════════════════════════════════════════════════════════
  //  HAVEN CLASS  (101 · 201 · 301)
  // ══════════════════════════════════════════════════════════
  {
    id: 'haven-101',
    class: 'Haven',
    priceClass: 'haven',
    roomNumber: '101',
    name: 'Haven 101',
    area: 20,
    guests: 2,
    bedType: 'Giường Đôi',
    floor: 1,
    shortDesc: 'Gọn gàng, sạch sẽ, đủ thứ bạn cần — Haven đúng nghĩa.',
    description: [
      'Haven 101 là phòng nhỏ gọn 20m², đủ tiện nghi và không có gì thừa. Nếu bạn cần một chỗ nghỉ lại gần sân bay Tân Sơn Nhất mà không muốn trả tiền cho những tiện ích bạn không dùng — đây là câu trả lời.',
      'Không gian được vệ sinh kỹ giữa mỗi lượt khách, ga giường thay mới 100%. Tự nhận phòng bằng mã cửa — tiện lợi cho mọi giờ đặt, kể cả đêm khuya hay sáng sớm.',
    ],
    amenities: [
      { icon: 'tv',     label: 'Smart TV' },
      { icon: 'wifi',   label: 'Wifi tốc độ cao' },
      { icon: 'ac',     label: 'Điều hoà inverter' },
      { icon: 'kettle', label: 'Ấm đun nước' },
      { icon: 'dryer',  label: 'Máy sấy tóc' },
      { icon: 'bath',   label: 'Dầu gội & Sữa tắm' },
      { icon: 'towel',  label: 'Khăn tắm mới' },
      { icon: 'key',    label: 'Tự nhận phòng 24/7' },
    ],
    images: makeImages(ROOM_IMAGES.r101),
    videoUrl: '', 
    tiktokEmbed: '',
  },

  {
    id: 'haven-201',
    class: 'Haven',
    priceClass: 'haven',
    roomNumber: '201',
    name: 'Haven 201',
    area: 20,
    guests: 2,
    bedType: 'Giường Đôi',
    floor: 2,
    shortDesc: 'Tầng 2 yên tĩnh, ánh sáng dịu — lý tưởng để nạp lại năng lượng.',
    description: [
      'Haven 201 nằm ở tầng 2, yên tĩnh hơn tầng 1 và có ánh sáng dịu hơn so với tầng 3. Phòng không quá rộng, không quá nhỏ — vừa đủ để bạn thở, nghỉ và ngủ ngon.',
      'Nhiều khách thường xuyên của Every Inn chọn Haven 201 làm "phòng quen" của mình — bởi sự yên tĩnh nhất quán và cảm giác riêng tư đủ để làm việc hay nghỉ dưỡng.',
    ],
    amenities: [
      { icon: 'tv',     label: 'Smart TV' },
      { icon: 'wifi',   label: 'Wifi tốc độ cao' },
      { icon: 'ac',     label: 'Điều hoà inverter' },
      { icon: 'kettle', label: 'Ấm đun nước' },
      { icon: 'dryer',  label: 'Máy sấy tóc' },
      { icon: 'bath',   label: 'Dầu gội & Sữa tắm' },
      { icon: 'towel',  label: 'Khăn tắm mới' },
      { icon: 'key',    label: 'Tự nhận phòng 24/7' },
    ],
    images: makeImages(ROOM_IMAGES.r201),
    videoUrl: '', 
    tiktokEmbed: '',
  },

  {
    id: 'haven-301',
    class: 'Haven',
    priceClass: 'haven',
    roomNumber: '301',
    name: 'Haven 301',
    area: 20,
    guests: 2,
    bedType: 'Giường Đôi',
    floor: 3,
    shortDesc: 'Cao nhất dòng Haven — cách âm tốt nhất, view thoáng, giá vẫn hợp lý.',
    description: [
      'Haven 301 kết hợp được điểm mạnh của tầng cao (yên tĩnh, thoáng) với mức giá thân thiện của dòng Haven. Đây là lựa chọn được nhiều khách lựa chọn khi ở dài hơn 2 đêm.',
      'Cách Tân Sơn Nhất chỉ vài phút, nhưng khi đóng cửa phòng lại, bạn sẽ không biết mình đang ở trung tâm thành phố sôi động nhất Việt Nam.',
    ],
    amenities: [
      { icon: 'tv',     label: 'Smart TV' },
      { icon: 'wifi',   label: 'Wifi tốc độ cao' },
      { icon: 'ac',     label: 'Điều hoà inverter' },
      { icon: 'kettle', label: 'Ấm đun nước' },
      { icon: 'dryer',  label: 'Máy sấy tóc' },
      { icon: 'bath',   label: 'Dầu gội & Sữa tắm' },
      { icon: 'towel',  label: 'Khăn tắm mới' },
      { icon: 'key',    label: 'Tự nhận phòng 24/7' },
    ],
    images: makeImages(ROOM_IMAGES.r301),
    videoUrl: '', 
    tiktokEmbed: '',
  },
];

// ── Helpers ───────────────────────────────────────────────────
export const getRoomById     = (id: string)  => ROOMS.find((r) => r.id === id) ?? null;
export const getRoomsByClass = (cls: string) => ROOMS.filter((r) => r.class === cls);
export const ROOM_CLASSES    = ['Signature', 'Haven'];
