"use client";
import React, { useState } from 'react';

type Tier = 'not_member' | 'bronze' | 'silver' | 'gold';

interface LoyaltyResult {
  found: boolean;
  phoneMasked?: string;
  tier?: Tier;
  lifetimeBookingCount?: number;
  nextTier?: { code: Tier; remainingBookings: number } | null;
  stamp?: {
    status: 'none' | 'active' | 'completed' | 'expired';
    currentStep: number;
    maxSteps: number;
    startsAt: string | null;
    expiresAt: string | null;
    nextMilestoneStep: number | null;
    milestones: Array<{ step: number; label: string; status: 'reached' | 'upcoming' }>;
  };
}

type ViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not_found' }
  | { kind: 'result'; data: LoyaltyResult };

const TIER_LABEL: Record<Tier, string> = {
  not_member: 'Chưa là thành viên',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));
}

export interface LoyaltyLookupProps {
  /**
   * When true (default), displays a graceful, premium 'Coming Soon' teaser
   * with disabled preview, preserving layout without annoying visitors.
   *
   * To re-enable live interactive lookup on production:
   *   1. Set comingSoon={false} on <LoyaltyLookup /> in src/app/page.tsx, OR
   *   2. Define NEXT_PUBLIC_LOYALTY_COMING_SOON=false in environment.
   */
  comingSoon?: boolean;
}

const COMING_SOON_DEFAULT = true;

export default function LoyaltyLookup({
  comingSoon = COMING_SOON_DEFAULT,
}: LoyaltyLookupProps) {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<ViewState>({ kind: 'idle' });

  // Toggle check: prop wins, fallback to env var check if set
  const isComingSoon =
    comingSoon &&
    (typeof process === 'undefined' ||
      process.env?.NEXT_PUBLIC_LOYALTY_COMING_SOON !== 'false');

  if (isComingSoon) {
    return (
      <section id="loyalty" className="ll-section ll-section--coming-soon" aria-labelledby="ll-heading">
        <div className="container">
          <div className="section-heading">
            <div className="ll-pill-wrapper">
              <span className="ll-coming-badge" role="status">
                <span className="ll-pulse-dot" aria-hidden="true" />
                Sắp ra mắt
              </span>
            </div>
            <h2 id="ll-heading">Tra cứu hạng thành viên &amp; tem</h2>
            <p className="ll-subheading">
              Chương trình hội viên Every Inn Club với nhiều đặc quyền lưu trú và tích tem đổi quà đang được hoàn thiện để phục vụ quý khách.
            </p>
          </div>

          <div className="ll-coming-container">
            {/* Reassurance note card */}
            <div className="ll-notice-card">
              <div className="ll-notice-header">
                <span className="ll-notice-icon" aria-hidden="true">✦</span>
                <div>
                  <h3 className="ll-notice-title">Đặc quyền đặt phòng vẫn luôn được tích lũy</h3>
                  <p className="ll-notice-desc">
                    Mọi lượt đặt phòng bằng số điện thoại của bạn hiện tại đều được hệ thống ghi nhận. Khi tính năng chính thức mở, tiến độ tem và hạng thành viên sẽ được cập nhật tự động!
                  </p>
                </div>
              </div>

              {/* 3 preview perks */}
              <div className="ll-perks-grid">
                <div className="ll-perk-item">
                  <span className="ll-perk-step">01</span>
                  <div className="ll-perk-content">
                    <strong>Hạng hội viên</strong>
                    <span>Bronze · Silver · Gold với ưu đãi giảm giá riêng cho từng lượt nghỉ.</span>
                  </div>
                </div>
                <div className="ll-perk-item">
                  <span className="ll-perk-step">02</span>
                  <div className="ll-perk-content">
                    <strong>Tích tem 10 bước</strong>
                    <span>Tích lũy mỗi đêm lưu trú để nhận voucher giảm giá &amp; đêm phòng miễn phí.</span>
                  </div>
                </div>
                <div className="ll-perk-item">
                  <span className="ll-perk-step">03</span>
                  <div className="ll-perk-content">
                    <strong>Tra cứu tiện lợi</strong>
                    <span>Chỉ cần nhập số điện thoại, không cần tải ứng dụng hay ghi nhớ mật khẩu.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Blurred / Disabled interactive preview with subtle depth */}
            <div className="ll-preview-wrapper" aria-hidden="true">
              <div className="ll-preview-backdrop">
                <form className="ll-form ll-form--disabled" onSubmit={(e) => e.preventDefault()}>
                  <label htmlFor="ll-phone-disabled" className="ll-sr">Số điện thoại</label>
                  <input
                    id="ll-phone-disabled"
                    type="tel"
                    disabled
                    tabIndex={-1}
                    placeholder="Số điện thoại, ví dụ 09xx xxx xxx"
                    value=""
                    readOnly
                  />
                  <button type="button" disabled tabIndex={-1}>
                    Kiểm tra
                  </button>
                </form>

                {/* Sample card illustration preview */}
                <div className="ll-card ll-card--preview">
                  <div className="ll-head">
                    <span className="ll-phone">09•• ••• 888</span>
                    <span className="ll-badge ll-gold">Gold Member</span>
                  </div>
                  <p className="ll-meta">
                    5 lượt đặt phòng · còn 3 lượt để mở khóa ưu đãi kế tiếp
                  </p>
                  <div className="ll-progress" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} className={`ll-dot${i < 5 ? ' on' : ''}`} />
                    ))}
                  </div>
                  <ul className="ll-milestones">
                    <li className="reached">
                      <strong>Tem 3</strong>
                      <span>Giảm giá đặt phòng lưu trú</span>
                    </li>
                    <li>
                      <strong>Tem 10</strong>
                      <span>Tặng 01 đêm nghỉ miễn phí</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Gentle floating teaser caption */}
              <div className="ll-preview-overlay">
                <span className="ll-lock-badge">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Tính năng đang được chuẩn bị ra mắt
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = phone.trim();
    if (state.kind === 'loading') return;
    if (!/^[0-9+\s().-]{8,32}$/.test(value)) {
      setState({ kind: 'error', message: 'Vui lòng nhập số điện thoại hợp lệ.' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/loyalty/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: value }),
        cache: 'no-store',
      });
      if (res.status === 400) {
        setState({ kind: 'error', message: 'Số điện thoại chưa đúng định dạng.' });
        return;
      }
      if (res.status === 429) {
        setState({ kind: 'error', message: 'Bạn thử lại sau ít phút nhé.' });
        return;
      }
      if (!res.ok) {
        setState({ kind: 'error', message: 'Hệ thống đang bận, vui lòng thử lại sau.' });
        return;
      }
      const data = (await res.json()) as LoyaltyResult;
      setState(data.found ? { kind: 'result', data } : { kind: 'not_found' });
    } catch {
      setState({ kind: 'error', message: 'Không thể kết nối, vui lòng thử lại.' });
    }
  }

  const result = state.kind === 'result' ? state.data : null;
  const stamp = result?.stamp;
  const active = stamp && (stamp.status === 'active' || stamp.status === 'completed');

  return (
    <section id="loyalty" className="ll-section" aria-labelledby="ll-heading">
      <div className="container">
        <div className="section-heading">
          <h2 id="ll-heading">Tra cứu hạng thành viên &amp; tem</h2>
          <p>Nhập số điện thoại đã dùng khi đặt phòng để xem hạng và tiến độ tích tem của bạn.</p>
        </div>

        <form className="ll-form" onSubmit={onSubmit} noValidate>
          <label htmlFor="ll-phone" className="ll-sr">Số điện thoại</label>
          <input
            id="ll-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Số điện thoại, ví dụ 09xx xxx xxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={32}
            aria-describedby="ll-status"
          />
          <button type="submit" disabled={state.kind === 'loading'}>
            {state.kind === 'loading' ? 'Đang kiểm tra…' : 'Kiểm tra'}
          </button>
        </form>

        <div id="ll-status" role="status" aria-live="polite" className="ll-status">
          {state.kind === 'error' && <p className="ll-error">{state.message}</p>}
          {state.kind === 'not_found' && (
            <p className="ll-note">Chưa tìm thấy thông tin cho số này. Đặt phòng lần đầu để bắt đầu tích tem nhé!</p>
          )}
        </div>

        {result && (
          <div className="ll-card">
            <div className="ll-head">
              <span className="ll-phone">{result.phoneMasked}</span>
              <span className={`ll-badge ll-${result.tier}`}>{TIER_LABEL[result.tier ?? 'not_member']}</span>
            </div>
            <p className="ll-meta">
              {result.lifetimeBookingCount ?? 0} lượt đặt phòng
              {result.nextTier ? ` · còn ${result.nextTier.remainingBookings} lượt để lên hạng ${TIER_LABEL[result.nextTier.code]}` : ''}
            </p>

            {stamp && (
              <>
                <div className="ll-progress" aria-label={`Tem ${stamp.currentStep}/${stamp.maxSteps}`}>
                  {Array.from({ length: stamp.maxSteps }, (_, i) => (
                    <span key={i} className={`ll-dot${active && i < stamp.currentStep ? ' on' : ''}`} />
                  ))}
                </div>
                <p className="ll-meta">
                  {stamp.status === 'expired'
                    ? 'Chu kỳ tem gần nhất đã hết hạn. Đặt phòng để bắt đầu chu kỳ mới.'
                    : stamp.status === 'none'
                      ? 'Bạn chưa có tem nào.'
                      : `Tem ${stamp.currentStep}/${stamp.maxSteps}${stamp.expiresAt ? ` · hết hạn ${fmtDate(stamp.expiresAt)}` : ''}`}
                </p>
                <ul className="ll-milestones">
                  {stamp.milestones.map((m) => (
                    <li key={m.step} className={m.status === 'reached' && stamp.status !== 'expired' ? 'reached' : ''}>
                      <strong>Tem {m.step}</strong>
                      <span>{m.label}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

