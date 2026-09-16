import React from 'react';
import { ROOM_CLASSES, getRoomsByClass } from '../data/rooms';
import RoomCard from './RoomCard';

const CLASS_META: Record<string, { tagline: string; badge: string | null }> = {
  Signature: { tagline: 'Không gian cao cấp, diện tích lớn, nhiều ánh sáng tự nhiên.', badge: 'Phổ biến nhất' },
  Haven: { tagline: 'Gọn gàng, sạch sẽ, đủ tiện nghi cho mọi hành trình.', badge: null },
};

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
