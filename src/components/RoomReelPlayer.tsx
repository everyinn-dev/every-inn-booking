'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RoomInfo } from '../data/rooms';

interface RoomReelPlayerProps {
  room: RoomInfo;
}

export default function RoomReelPlayer({ room }: RoomReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<string>('0:00');
  const [duration, setDuration] = useState<string>('0:00');
  const [showPlayPulse, setShowPlayPulse] = useState<boolean>(false);
  const [pulseType, setPulseType] = useState<'play' | 'pause'>('play');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Format seconds to M:SS
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // IntersectionObserver: Auto-play when scrolled in, pause when scrolled out
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = videoRef.current;
          if (!video) return;

          if (entry.isIntersecting) {
            video.play().then(() => setIsPlaying(true)).catch(() => {
              // Browser autoplay policy prevented playback
              setIsPlaying(false);
            });
          } else {
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Update progress
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    const total = video.duration || 0;
    setCurrentTime(formatTime(current));

    if (total > 0) {
      setProgress((current / total) * 100);
      setDuration(formatTime(total));
    }
  };

  // Toggle play / pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        setPulseType('play');
        setShowPlayPulse(true);
        setTimeout(() => setShowPlayPulse(false), 600);
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      setPulseType('pause');
      setShowPlayPulse(true);
      setTimeout(() => setShowPlayPulse(false), 600);
    }
  }, []);

  // Toggle sound
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Toggle Fullscreen
  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Click on progress bar to seek
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    const bar = e.currentTarget;
    if (!video || !bar) return;

    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    video.currentTime = newProgress * video.duration;
  };

  if (!room.videoUrl) return null;

  return (
    <section className="reel-showcase-section" aria-label={`Video không gian phòng ${room.name}`}>
      <div className="reel-showcase-header">
        <div className="reel-tag-wrap">
          <span className="reel-badge-pill">
            <span className="reel-dot" /> Every Inn Reel
          </span>
          <span className="reel-room-name">{room.name}</span>
        </div>
        <h2 className="reel-showcase-title">Video Tour Thực Tế Không Gian</h2>
        <p className="reel-showcase-desc">
          Trải nghiệm trọn vẹn từng góc nhìn, ánh sáng và chi tiết nội thất phòng {room.name} được quay trực tiếp 100% tại Every Inn.
        </p>
      </div>

      <div className="reel-layout-grid">
        {/* 9:16 Portrait Reel Player */}
        <div className="reel-player-wrapper">
          <div
            ref={containerRef}
            className="reel-player-container"
            onClick={togglePlay}
            role="button"
            tabIndex={0}
            aria-label={isPlaying ? 'Tạm dừng video' : 'Phát video'}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                togglePlay();
              }
            }}
          >
            <video
              ref={videoRef}
              src={room.videoUrl}
              poster={room.videoPoster}
              playsInline
              loop
              muted={isMuted}
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleTimeUpdate}
              className="reel-video-element"
            />

            {/* Tap animation feedback */}
            {showPlayPulse && (
              <div className="reel-pulse-indicator" aria-hidden="true">
                {pulseType === 'play' ? (
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="white">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                )}
              </div>
            )}

            {/* Top Overlay Bar */}
            <div className="reel-top-bar" onClick={(e) => e.stopPropagation()}>
              <div className="reel-live-tag">
                <span className="reel-live-dot" />
                <span>HD 720p · 9:16</span>
              </div>
              <button
                type="button"
                className="reel-control-icon-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                aria-label="Toàn màn hình"
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Bottom Overlay Controls */}
            <div className="reel-bottom-controls" onClick={(e) => e.stopPropagation()}>
              <div className="reel-info-row">
                <div className="reel-caption">
                  <span className="reel-caption-title">{room.name}</span>
                  <span className="reel-caption-sub">Tầng {room.floor} · {room.area}m² · {room.bedType}</span>
                </div>
                <button
                  type="button"
                  className={`reel-sound-toggle-btn ${!isMuted ? 'active' : ''}`}
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
                >
                  {isMuted ? (
                    <>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                      <span>Bật tiếng</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                      <span>Đang phát</span>
                    </>
                  )}
                </button>
              </div>

              {/* Progress bar */}
              <div
                className="reel-progress-wrapper"
                onClick={handleProgressClick}
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="reel-progress-bar">
                  <div className="reel-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="reel-time-label">
                  <span>{currentTime}</span> / <span>{duration}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Card (Desktop & Tablet) */}
        <div className="reel-highlights-card">
          <div className="reel-hl-badge">Ưu Điểm Nổi Bật</div>
          <h3 className="reel-hl-title">Không gian nghỉ dưỡng chuẩn gu</h3>
          <ul className="reel-hl-list">
            <li>
              <div className="reel-hl-icon">✓</div>
              <div>
                <strong>Video quay thực tế 100%</strong>
                <p>Không qua chỉnh sửa góc rộng phóng đại, cam kết phòng thực tế đúng như hình ảnh và video bạn xem.</p>
              </div>
            </li>
            <li>
              <div className="reel-hl-icon">✓</div>
              <div>
                <strong>Đón ánh sáng tự nhiên &amp; yên tĩnh</strong>
                <p>Không gian được cách âm tốt trong hẻm yên bình Nguyễn Công Hoan, đón ánh sáng ban mai nhẹ nhàng.</p>
              </div>
            </li>
            <li>
              <div className="reel-hl-icon">✓</div>
              <div>
                <strong>Tự nhận phòng 24/7 riêng tư</strong>
                <p>Mã khoá thông minh kích hoạt tự động, nhận phòng mọi khung giờ ngày đêm mà không cần chờ đợi.</p>
              </div>
            </li>
          </ul>

          <div className="reel-hl-footer">
            <span className="reel-hl-pill">Phòng đầy đủ tiện nghi</span>
            <span className="reel-hl-pill">Smart TV netflix</span>
            <span className="reel-hl-pill">Ga đệm sạch 100%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
