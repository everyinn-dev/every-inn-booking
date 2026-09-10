import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Hero() {
  return (
    <section className="hero" aria-label="Every Inn – Hotels, Homes and Everything In">
      <img
        src="https://res.cloudinary.com/gsldcdgb/image/upload/c_fill,w_1920,h_1080,q_80,f_auto/v1785586463/36_iwxmar.jpg"
        alt="Every Inn – Phòng Signature 102, Nguyễn Công Hoan"
        width="1920"
        height="1080"
        fetchPriority="high"
        decoding="sync"
        style={{ objectFit: 'cover', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <div className="hero-content">
        <p className="hero-tagline">Hotels · Homes · Everything In</p>
        <h1>EVERY INN</h1>
        <p className="hero-sub">Một nơi để vừa hòa mình vào nhịp sống Sài Gòn, vừa giữ cho mình một góc bình yên riêng.</p>
        <div className="hero-actions">
          <Link href="#pricing" className="btn-primary">Xem bảng giá</Link>
          <Link href="#rooms" className="btn-outline-light">Khám phá phòng</Link>
        </div>
      </div>
    </section>
  );
}
