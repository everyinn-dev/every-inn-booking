"use client";
import React, { useEffect, useRef, useState } from 'react';

export default function Location() {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );

    if (placeholderRef.current) {
      observer.observe(placeholderRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="location" className="map-section" aria-labelledby="map-heading">
      <div className="container">
        <div className="section-heading">
          <h2 id="map-heading">Vị trí của chúng tôi</h2>
          <p>69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu – Cách sân bay Tân Sơn Nhất ~15 phút, gần trung tâm thành phố.</p>
          <div style={{ marginTop: '0.75rem' }}>
            <a
              href="https://www.google.com/maps/place/Every+Inn+-+Apartments+%26+Hotel/@10.7998871,106.6889157,17z/data=!3m1!4b1!4m6!3m5!1s0x317529888f02f98b:0xbe09bebbc5faf92e!8m2!3d10.7998871!4d106.6889157"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors underline underline-offset-4"
              aria-label="Xem Every Inn trên Google Maps"
            >
              <span>📍 Mở vị trí và xem chỉ đường trên Google Maps</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        </div>
        <div className="map-container">
          {shouldLoad ? (
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.1491420908674!2d106.68891567437291!3d10.799887089350332!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x317529888f02f98b%3A0xbe09bebbc5faf92e!2sEvery%20Inn%20-%20Apartments%20%26%20Hotel!5e0!3m2!1sen!2s!4v1788677329623!5m2!1sen!2s"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              title="Every Inn – vị trí trên Google Maps"
            />
          ) : (
            <div ref={placeholderRef} className="map-placeholder" role="img" aria-label="Bản đồ vị trí Every Inn">
              <span>Đang tải bản đồ…</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
