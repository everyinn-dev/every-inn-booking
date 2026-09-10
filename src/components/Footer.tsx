import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container footer-inner">
        <Link href="/" className="logo footer-logo" aria-label="Every Inn – Trang chủ">
          <img
            src="https://res.cloudinary.com/gsldcdgb/image/upload/v1788681602/My%20Brand/LOGO_1_wbjveg.png"
            alt="Every Inn Logo"
            className="logo-img footer-logo-img"
            width="52"
            height="52"
          />
          <span className="logo-text">EVERY INN</span>
        </Link>
        <p className="footer-tagline">Hotels · Homes · Everything In</p>
        <address className="footer-address">
          69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu (Quận Phú Nhuận cũ), Thành phố Hồ Chí Minh.
        </address>
        <div className="footer-links">
          <a
            href="https://www.instagram.com/everyinn.home/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram @everyinn.home"
          >
            @everyinn.home
          </a>
          <a href="tel:+840906314109">0906.314.109</a>
          <a href="mailto:hi.everyinn@gmail.com">hi.everyinn@gmail.com</a>
        </div>
        <p className="footer-copy">© 2026 Every Inn. All rights reserved.</p>
      </div>
    </footer>
  );
}
