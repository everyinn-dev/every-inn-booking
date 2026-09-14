'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface RoomCarouselProps {
  images: string[];
  roomName: string;
}

export default function RoomCarousel({ images, roomName }: RoomCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const totalSlides = images.length;

  const nextSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const openLightbox = (index: number) => {
    setCurrentSlide(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, nextSlide, prevSlide]);

  if (!images || images.length === 0) return null;

  return (
    <>
      <section className="room-carousel-container container" aria-label="Ảnh phòng">
        <div
          className="room-carousel-track"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {images.map((src, idx) => (
            <div
              key={idx}
              className="carousel-slide"
              onClick={() => openLightbox(idx)}
              role="button"
              tabIndex={0}
              aria-label={`Mở ảnh ${idx + 1} của ${roomName}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  openLightbox(idx);
                }
              }}
            >
              <img
                src={src}
                alt={`${roomName} – ảnh ${idx + 1}`}
                loading={idx === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </div>
          ))}
        </div>

        {totalSlides > 1 && (
          <>
            <button
              type="button"
              className="carousel-btn prev"
              onClick={prevSlide}
              aria-label="Ảnh trước"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="carousel-btn next"
              onClick={nextSlide}
              aria-label="Ảnh sau"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}
      </section>

      {/* Full-Screen Lightbox */}
      <div
        className={`lightbox ${isLightboxOpen ? 'active' : ''}`}
        aria-hidden={!isLightboxOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeLightbox();
        }}
      >
        <button
          type="button"
          className="lightbox-close"
          onClick={closeLightbox}
          aria-label="Đóng gallery"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {totalSlides > 1 && (
          <button
            type="button"
            className="lightbox-btn prev"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            aria-label="Ảnh trước"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
          <img
            className="lightbox-img"
            src={images[currentSlide]}
            alt={`${roomName} – ảnh lớn ${currentSlide + 1}`}
          />
        </div>

        {totalSlides > 1 && (
          <button
            type="button"
            className="lightbox-btn next"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            aria-label="Ảnh sau"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
