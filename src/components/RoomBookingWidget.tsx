'use client';

import React, { useState, useEffect } from 'react';
import {
  RoomClassKey,
  PRICE_MANAGER,
  EXTRA_HOUR_FEE,
  getEffectivePrices,
  getDayName,
  fmtVND,
} from '../data/pricing';
import { IgIcon } from './Icons';

const IG_URL = 'https://www.instagram.com/everyinn.home/';

const PRICE_TYPES = [
  { key: 'combo3h',   label: 'Combo 3H',    note: '' },
  { key: 'combo6h',   label: 'Combo 6H',    note: '' },
  { key: 'overnight', label: 'Qua đêm',     note: '21h – 9h' },
  { key: 'dayroom',   label: 'Phòng ngày',  note: '15h – 12h' },
];

const VI_DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface RoomBookingWidgetProps {
  priceClass: RoomClassKey;
}

export default function RoomBookingWidget({ priceClass }: RoomBookingWidgetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const today = new Date();
  const result = getEffectivePrices(priceClass, today);
  const dayName = getDayName(today);
  const dayShort = VI_DAYS_SHORT[today.getDay()];
  const { specialDeal } = PRICE_MANAGER;

  return (
    <aside className="right-sidebar" aria-label="Đặt phòng">
      <div className="booking-widget">
        <h3 className="bw-title">Giá phòng hôm nay</h3>

        {mounted ? (
          result.isSale ? (
            <div className="bw-status sale">
              🎉 {PRICE_MANAGER.promo.label} {PRICE_MANAGER.promo.badgeText} áp dụng hôm nay ({dayName})
            </div>
          ) : (
            <div className="bw-status neutral">
              Giá tiêu chuẩn – {dayName} ({dayShort})
            </div>
          )
        ) : (
          <div className="bw-status neutral">Giá phòng hôm nay</div>
        )}

        <div className="bw-prices">
          {PRICE_TYPES.map(({ key, label, note }) => {
            const p = result.prices[key];
            const orig = result.original?.[key];
            const diff = orig && orig !== p;
            const isSpecial = specialDeal.enabled && specialDeal.appliesTo.includes(key);

            return (
              <div key={key} className="bw-price-row">
                <div className="bw-price-label">
                  <span>{label}</span>
                  {note && <span className="bw-note">{note}</span>}
                  {isSpecial && (
                    <span className="bw-deal-tip" title={`${specialDeal.emoji} ${specialDeal.label}`}>
                      ★
                    </span>
                  )}
                </div>
                <div className="bw-price-val">
                  {diff && <span className="bw-orig">{fmtVND(orig)}</span>}
                  <span className="bw-final">{fmtVND(p)}</span>
                  {diff && <span className="bw-badge">{PRICE_MANAGER.promo.badgeText}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <p className="bw-extra">+ Giờ tiếp theo: {fmtVND(EXTRA_HOUR_FEE)}/h (tối đa 2h)</p>
        {specialDeal.enabled && (
          <p className="bw-deal-note">
            {specialDeal.emoji} {specialDeal.label} <em>(Qua đêm &amp; Phòng ngày)</em>
          </p>
        )}

        <a
          href={IG_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary btn-full"
          id="cta-book"
        >
          <IgIcon />
          <span>Nhắn tin đặt phòng</span>
        </a>
        <p className="booking-sub">Phản hồi trong 15 phút · @everyinn.home</p>
      </div>
    </aside>
  );
}
