'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { RoomInfo } from '../data/rooms';
import { getCheapestPrice, getEffectivePrices, PRICE_MANAGER, fmtVND } from '../data/pricing';
import { AreaIcon, GuestsIcon, FloorIcon } from './Icons';

interface RoomCardProps {
  room: RoomInfo;
}

export default function RoomCard({ room }: RoomCardProps) {
  const cheapest = getCheapestPrice(room.priceClass);
  const { isSale } = getEffectivePrices(room.priceClass);

  const images = room.images.gallery?.length ? room.images.gallery : [room.images.thumbnail];
  const total = images.length;
  const [currentIndex, setCurrentIndex] = useState(0);

  // Swipe gesture tracking
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const didSwipe = useRef<boolean>(false);

  const prevSlide = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const nextSlide = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
      didSwipe.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      didSwipe.current = true;
      if (diffX > 0) {
        prevSlide();
      } else {
        nextSlide();
      }
    }
  };

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    isDragging.current = true;
    didSwipe.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const diffX = e.clientX - touchStartX.current;
    const diffY = e.clientY - touchStartY.current;
    if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
      didSwipe.current = true;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diffX = e.clientX - touchStartX.current;
    const diffY = e.clientY - touchStartY.current;
    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      didSwipe.current = true;
      if (diffX > 0) {
        prevSlide();
      } else {
        nextSlide();
      }
    }
  };

  // Prevent navigation if user was swiping images
  const handleClickCapture = (e: React.MouseEvent) => {
    if (didSwipe.current) {
      e.preventDefault();
      e.stopPropagation();
      didSwipe.current = false;
    }
  };

  return (
    <Link
      href={`/room/${room.id}`}
      className="room-card"
      aria-label={`Xem phòng ${room.name}`}
      onClickCapture={handleClickCapture}
    >
      <div
        className="room-img"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isDragging.current = false;
        }}
      >
        <div
          className="room-img-track"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`${room.name} – ảnh ${idx + 1}`}
              width="1080"
              height="1350"
              loading={idx === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          ))}
        </div>

        <span className="room-badge">Tầng {room.floor}</span>
        {isSale && <span className="room-sale-badge">{PRICE_MANAGER.promo.badgeText}</span>}

        {total > 1 && (
          <>
            <button
              type="button"
              className="card-arrow prev"
              onClick={prevSlide}
              aria-label={`Xem ảnh trước của phòng ${room.name}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="card-arrow next"
              onClick={nextSlide}
              aria-label={`Xem ảnh sau của phòng ${room.name}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            <div className="card-dots" aria-hidden="true">
              {images.map((_, idx) => (
                <span
                  key={idx}
                  className={`card-dot ${idx === currentIndex ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="room-info">
        <h4>{room.name}</h4>
        <div className="room-meta">
          <span>
            <AreaIcon /> {room.area}m²
          </span>
          <span>
            <GuestsIcon /> {room.guests} Khách
          </span>
          <span>
            <FloorIcon /> Tầng {room.floor}
          </span>
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
