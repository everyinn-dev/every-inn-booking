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

export default function LoyaltyLookup() {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<ViewState>({ kind: 'idle' });

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

