import React from 'react';
import { GOOGLE_REVIEWS, GOOGLE_REVIEWS_SOURCE } from '../data/reviews';

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.7c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1C6.3 6.8 8.9 4.7 12 4.7z" />
    </svg>
  );
}

const STARS = '★★★★★';

export default function GoogleReviews() {
  const { rating, count, url } = GOOGLE_REVIEWS_SOURCE;
  return (
    <section id="reviews" className="gr-section" aria-labelledby="gr-heading">
      <div className="container">
        <div className="gr-head">
          <div className="gr-kicker">
            <GoogleG />
            <span>Đánh giá từ Google</span>
          </div>
          <h2 id="gr-heading">Khách đã nói gì về Every Inn</h2>
        </div>

        <div className="gr-layout">
          <aside className="gr-score" aria-label={`Điểm Google ${rating} trên 5 sao, ${count} đánh giá`}>
            <div className="gr-score-num">{rating.toFixed(1).replace('.', ',')}</div>
            <div className="gr-stars" aria-hidden="true">{STARS}</div>
            <div className="gr-score-count">{count} đánh giá</div>
            <a className="gr-score-link" href={url} target="_blank" rel="noopener noreferrer">
              Xem trên Google Maps
            </a>
          </aside>

          <div className="gr-rail" tabIndex={0} role="region" aria-label="Các đánh giá của khách trên Google">
            {GOOGLE_REVIEWS.map((r) => (
              <article className="gr-card" key={r.name}>
                <div className={`gr-photos gr-photos--${r.photos.length}`}>
                  {r.photos.map((src, i) => (
                    <img
                      key={src}
                      src={src}
                      alt={`Ảnh khách ${r.name} chụp tại Every Inn${r.photos.length > 1 ? ` (${i + 1})` : ''}`}
                      width={900}
                      height={900}
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </div>
                <div className="gr-body">
                  <p className="gr-text">“{r.text}”</p>
                  <div className="gr-meta">
                    <strong>{r.name}</strong>
                    <span className="gr-meta-right">
                      <span className="gr-stars" aria-label={`${r.stars} sao`}>{STARS}</span>
                      <GoogleG size={14} />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
