/**
 * data/pricing.ts
 * ─────────────────────────────────────────────────────────────────────────
 * 🎛️  PRICE MANAGER — Edit this file to change ALL pricing on the website.
 *     No other code changes are needed.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type RoomClassKey = 'haven' | 'signature';

// ── BASE PRICES ────────────────────────────────────────────────────────────
// Standard prices before any promotion. Edit to update base rates.
export const BASE_PRICES: Record<RoomClassKey, Record<string, number>> = {
  haven: {
    combo3h:   320_000, // Combo 3 giờ
    combo6h:   600_000, // Combo 6 giờ
    overnight: 490_000, // Qua đêm  (21:00 → 09:00 hôm sau)
    dayroom:   590_000, // Phòng ngày (15:00 → 12:00 hôm sau)
  },
  signature: {
    combo3h:   360_000,
    combo6h:   640_000,
    overnight: 620_000,
    dayroom:   750_000,
  },
};

// Extra-hour add-on (applies to all rooms)
export const EXTRA_HOUR_FEE = 60_000; // per hour, max 2 hours

// ── PRICE MANAGER ──────────────────────────────────────────────────────────
export const PRICE_MANAGER = {
  promo: {
    enabled: true,
    label: 'Ưu đãi khai trương',
    badgeText: '-20%',
    days: [0, 1, 2, 3, 4],
    endsOn: '2026-09-30' as string | null,
    mode: 'percent_off' as 'percent_off' | 'percent_up' | 'manual' | 'none',
    percentValue: 20,
    manualPrices: {
      haven: {
        combo3h:   null as number | null,
        combo6h:   null as number | null,
        overnight: null as number | null,
        dayroom:   null as number | null,
      },
      signature: {
        combo3h:   null as number | null,
        combo6h:   null as number | null,
        overnight: null as number | null,
        dayroom:   null as number | null,
      },
    },
  },
  specialDeal: {
    enabled: true,
    label: 'Đặt từ 2 đêm giảm ngay 100.000đ',
    emoji: '🔥',
    appliesTo: ['overnight', 'dayroom'],
    minUnits: 2,
    flatOff: 100_000,
  },
};

// ── HELPERS ────────────────────────────────────────────────────────────────

const VI_DAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export const fmtVND = (n: number) => n.toLocaleString('vi-VN') + 'đ';

export const getDayName = (date: Date) => VI_DAYS[date.getDay()];

export interface EffectivePrices {
  isSale: boolean;
  prices: Record<string, number>;
  original: Record<string, number> | null;
  label: string;
  badgeText: string;
  reason: 'promo' | 'manual_override' | 'base' | 'expired' | 'day_excluded';
}

export function getEffectivePrices(classKey: RoomClassKey, date: Date = new Date()): EffectivePrices {
  const base = { ...BASE_PRICES[classKey] };
  const { promo } = PRICE_MANAGER;

  if (!promo.enabled || promo.mode === 'none') {
    return { isSale: false, prices: base, original: null, label: '', badgeText: '', reason: 'base' };
  }

  if (promo.endsOn) {
    const expiry = new Date(promo.endsOn + 'T23:59:59+07:00');
    if (date > expiry) {
      return { isSale: false, prices: base, original: null, label: '', badgeText: '', reason: 'expired' };
    }
  }

  if (!promo.days.includes(date.getDay())) {
    return { isSale: false, prices: base, original: null, label: '', badgeText: '', reason: 'day_excluded' };
  }

  let promoPrice: Record<string, number> = {};

  if (promo.mode === 'percent_off') {
    const factor = 1 - promo.percentValue / 100;
    promoPrice = Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, Math.round(v * factor)])
    );
  } else if (promo.mode === 'percent_up') {
    const factor = 1 + promo.percentValue / 100;
    promoPrice = Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, Math.round(v * factor)])
    );
  } else if (promo.mode === 'manual') {
    const manual = (promo.manualPrices[classKey] as Record<string, number | null>) ?? {};
    promoPrice = Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, manual[k] ?? v])
    );
  }

  const hasChange = Object.entries(promoPrice).some(([k, v]) => v !== base[k]);

  return {
    isSale: hasChange,
    prices: promoPrice,
    original: hasChange ? base : null,
    label: promo.label,
    badgeText: promo.badgeText,
    reason: 'promo',
  };
}

export function getCheapestPrice(classKey: RoomClassKey, date: Date = new Date()) {
  const { prices } = getEffectivePrices(classKey, date);
  return Math.min(...Object.values(prices));
}
