"use client";
import React, { useState, useEffect } from 'react';
import { PRICE_MANAGER, EXTRA_HOUR_FEE, getEffectivePrices, getDayName, fmtVND } from '../data/pricing';
import { IgIcon } from './Icons';

const IG_URL = 'https://www.instagram.com/everyinn.home/';
const VI_DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const PRICE_TYPES = [
  { key: 'combo3h', label: 'COMBO 3H', sub: '' },
  { key: 'combo6h', label: 'COMBO 6H', sub: '' },
  { key: 'overnight', label: 'QUA ĐÊM', sub: '21h – 9h' },
  { key: 'dayroom', label: 'PHÒNG NGÀY', sub: '15h – 12h' },
];

function buildStatusBadge(date: Date) {
  const haven = getEffectivePrices('haven', date);
  const { promo } = PRICE_MANAGER;
  const dayName = getDayName(date);
  const dayShort = VI_DAYS_SHORT[date.getDay()];

  if (!promo.enabled) {
    return <div className="pc-status neutral"><span>Giá tiêu chuẩn</span></div>;
  }

  if (haven.reason === 'expired') {
    return (
      <div className="pc-status neutral">
        <span>Chương trình ưu đãi đã kết thúc – Áp dụng giá tiêu chuẩn</span>
      </div>
    );
  }

  if (haven.isSale) {
    return (
      <div className="pc-status sale">
        <span className="pc-fire">🎉</span>
        <span>
          <strong>{dayName} ({dayShort})</strong> – Đang áp dụng <strong>{promo.label} {promo.badgeText}</strong>
        </span>
      </div>
    );
  }

  const saleDay = promo.days.map((d) => VI_DAYS_SHORT[d]).join(', ');
  return (
    <div className="pc-status info">
      <span>ℹ️ <strong>{dayName} ({dayShort})</strong> – Giá tiêu chuẩn (Ưu đãi áp dụng: {saleDay})</span>
    </div>
  );
}

function PriceRow({ classKey, className, date }: { classKey: 'haven' | 'signature', className: string, date: Date }) {
  const result = getEffectivePrices(classKey, date);

  return (
    <tr>
      <th className="pc-row-label">
        <strong>{className}</strong>
        <span>({classKey === 'haven' ? '101/201/301' : '102/202/302'})</span>
      </th>
      {PRICE_TYPES.map(({ key }) => {
        const p = result.prices[key];
        const orig = result.original?.[key];
        const diff = orig && orig !== p;

        return (
          <td key={key} className={`pc-cell ${result.isSale ? 'is-sale' : ''}`}>
            {diff && <span className="pc-orig">{fmtVND(orig)}</span>}
            <span className="pc-price">{fmtVND(p)}</span>
            {diff && <span className="pc-badge">{PRICE_MANAGER.promo.badgeText}</span>}
          </td>
        );
      })}
    </tr>
  );
}

export default function Pricing() {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    // Set initial date only on the client to avoid hydration mismatch
    setDate(new Date());
  }, []);

  if (!date) return null; // or a skeleton

  const todayStr = new Date().toISOString().split('T')[0];
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const { specialDeal } = PRICE_MANAGER;

  return (
    <section id="pricing" className="pricing-section" aria-labelledby="pricing-heading">
      <div className="container">
        <div className="section-heading">
          <h2 id="pricing-heading">Bảng giá</h2>
          <p>Chọn ngày để xem giá áp dụng — tự động cập nhật ưu đãi theo ngày.</p>
        </div>
        
        <div id="price-calculator" aria-live="polite">
          <div className="pc-top">
            <div className="pc-date-wrap">
              <label htmlFor="pc-date" className="pc-date-label">📅 Chọn ngày check-in</label>
              <input
                type="date"
                id="pc-date"
                value={dateStr}
                min={todayStr}
                className="pc-date-input"
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const [y, m, d] = val.split('-').map(Number);
                  setDate(new Date(y, m - 1, d));
                }}
              />
            </div>
            <div id="pc-status" className="pc-status">
              {buildStatusBadge(date)}
            </div>
          </div>

          <div className="pc-table-scroll" role="region" aria-label="Bảng giá phòng" tabIndex={0}>
            <table className="pc-table">
              <thead>
                <tr>
                  <th className="pc-th-room">Hạng phòng</th>
                  {PRICE_TYPES.map(({ label, sub }) => (
                    <th key={label}>
                      {label}
                      {sub && <><br /><span className="pc-sub">{sub}</span></>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody id="pc-tbody">
                <PriceRow classKey="haven" className="Haven" date={date} />
                <PriceRow classKey="signature" className="Signature" date={date} />
              </tbody>
            </table>
          </div>

          <div className="pc-notes">
            <p>+ Giờ tiếp theo: {fmtVND(EXTRA_HOUR_FEE)}/h (tối đa 2 giờ)</p>
            {specialDeal.enabled && (
              <p className="pc-deal">
                {specialDeal.emoji} {specialDeal.label} <em>(áp dụng Qua đêm &amp; Phòng ngày)</em>
              </p>
            )}
          </div>

          <div className="pc-cta">
            <a href={IG_URL} target="_blank" rel="noopener noreferrer" className="btn-primary btn-full btn-cta-lg" id="cta-main">
              <IgIcon /> Nhắn tin đặt phòng ngay
            </a>
            <p className="pc-cta-note">Phản hồi trong 15 phút · @everyinn.home</p>
          </div>
        </div>
      </div>
    </section>
  );
}
