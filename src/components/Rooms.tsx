import React from 'react';
import Link from 'next/link';
import { ROOM_CLASSES, getRoomsByClass, RoomInfo } from '../data/rooms';
import { getCheapestPrice, getEffectivePrices, PRICE_MANAGER, fmtVND, RoomClassKey } from '../data/pricing';
import { AreaIcon, GuestsIcon, FloorIcon } from './Icons';

const CLASS_META: Record<string, { tagline: string; badge: string | null }> = {
  Signature: { tagline: 'Không gian cao cấp, diện tích lớn, nhiều ánh sáng tự nhiên.', badge: 'Phổ biến nhất' },
  Haven: { tagline: 'Gọn gàng, sạch sẽ, đủ tiện nghi cho mọi hành trình.', badge: null },
};

function RoomCard({ room }: { room: RoomInfo }) {
  const cheapest = getCheapestPrice(room.priceClass);
  const { isSale } = getEffectivePrices(room.priceClass);

  return (
    <Link href={`/room/${room.id}`} className="room-card" aria-label={`Xem phòng ${room.name}`}>
      <div className="room-img">
        <img
          src={room.images.thumbnail}
          alt={`${room.name} – Every Inn, Nguyễn Công Hoan`}
          width="1080"
          height="1350"
          loading="lazy"
          decoding="async"
        />
        <span className="room-badge">Tầng {room.floor}</span>
        {isSale && <span className="room-sale-badge">{PRICE_MANAGER.promo.badgeText}</span>}
      </div>
      <div className="room-info">
        <h4>{room.name}</h4>
        <div className="room-meta">
          <span><AreaIcon /> {room.area}m²</span>
          <span><GuestsIcon /> {room.guests} Khách</span>
          <span><FloorIcon /> Tầng {room.floor}</span>
        </div>
        <p className="room-short-desc">{room.shortDesc}</p>
        <div className="room-price">
          <span className="price-amount">Từ {fmtVND(cheapest)}</span>
          <span className="book-link">Xem phòng →</span>
        </div>
      </div>
    </Link>
  );
}

function ClassBlock({ className }: { className: string }) {
  const rooms = getRoomsByClass(className);
  const meta = CLASS_META[className] ?? { tagline: '', badge: null };
  return (
    <div className="room-class-block" id={`class-${className.toLowerCase()}`}>
      <div className="room-class-header">
        <div>
          <h3>
            {className}
            {meta.badge && <span className="class-badge" style={{ marginLeft: 8 }}>{meta.badge}</span>}
          </h3>
          <p>{meta.tagline}</p>
        </div>
      </div>
      <div className="room-grid">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}

export default function Rooms() {
  return (
    <section id="rooms" className="room-classes" aria-labelledby="rooms-heading">
      <div className="container">
        <div className="section-heading">
          <h2 id="rooms-heading">Lựa chọn Hạng phòng dành cho bạn</h2>
          <p>Không gian tối giản, ấm cúng và đủ tiện nghi. Hai dòng phòng cho mọi nhu cầu lưu trú.</p>
        </div>
        <div id="rooms-root" aria-live="polite">
          {ROOM_CLASSES.map((cls) => (
            <ClassBlock key={cls} className={cls} />
          ))}
        </div>
      </div>
    </section>
  );
}
