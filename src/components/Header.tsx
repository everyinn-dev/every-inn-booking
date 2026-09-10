"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeNav = () => {
    setIsNavOpen(false);
    document.body.style.overflow = '';
  };

  const toggleNav = () => {
    const nextState = !isNavOpen;
    setIsNavOpen(nextState);
    document.body.style.overflow = nextState ? 'hidden' : '';
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNav();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className={`site-header ${isScrolled ? 'scrolled' : ''}`} role="banner">
      <div className="container header-inner">
        <Link href="/" className="logo" aria-label="Every Inn – Trang chủ" onClick={closeNav}>
          <img
            src="https://res.cloudinary.com/gsldcdgb/image/upload/v1788681602/My%20Brand/LOGO_1_wbjveg.png"
            alt="Every Inn Logo"
            className="logo-img"
            width="40"
            height="40"
          />
          <span className="logo-text">EVERY INN</span>
        </Link>

        <nav id="nav-links" className={`nav-links ${isNavOpen ? 'is-open' : ''}`} aria-label="Menu chính">
          <Link href="#rooms" onClick={closeNav}>Hạng phòng</Link>
          <Link href="#pricing" onClick={closeNav}>Bảng giá</Link>
          <Link href="#location" onClick={closeNav}>Vị trí</Link>
          <a
            href="https://www.instagram.com/everyinn.home/"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-ig"
            onClick={closeNav}
          >
            Instagram
          </a>
        </nav>

        <button
          id="nav-toggle"
          className="nav-toggle"
          aria-label={isNavOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={isNavOpen}
          aria-controls="nav-links"
          onClick={toggleNav}
        >
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </button>
      </div>
    </header>
  );
}
