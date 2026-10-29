import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_PRICES,
  getEffectivePrices,
  isSpecialDealActive,
  formatYMD,
} from '../src/data/pricing.ts';

test('Promo: Normal weekday (Wednesday 2026-11-18) applies full discount', () => {
  const wednesday = new Date('2026-11-18T12:00:00+07:00');
  const haven = getEffectivePrices('haven', wednesday);
  const signature = getEffectivePrices('signature', wednesday);

  assert.equal(haven.isSale, true);
  assert.equal(haven.reason, 'promo');
  assert.equal(haven.badgeText, '-10%');
  assert.equal(haven.prices.combo3h, 288_000);
  assert.equal(haven.prices.overnight, 468_000);
  assert.equal(haven.prices.dayroom, 558_000);

  assert.equal(signature.isSale, true);
  assert.equal(signature.reason, 'promo');
  assert.equal(signature.badgeText, '-15%');
  assert.equal(signature.prices.combo3h, 306_000);
  assert.equal(signature.prices.overnight, 527_000);
  assert.equal(signature.prices.dayroom, 637_500);

  assert.equal(isSpecialDealActive(wednesday), true);
});

test('Promo: Friday (2026-11-20) keeps dayroom at base price, discounts combo3h & overnight', () => {
  const friday = new Date('2026-11-20T12:00:00+07:00');
  assert.equal(friday.getDay(), 5, 'Date should be Friday');

  const haven = getEffectivePrices('haven', friday);
  assert.equal(haven.isSale, true);
  assert.equal(haven.prices.combo3h, 288_000);
  assert.equal(haven.prices.overnight, 468_000);
  assert.equal(haven.prices.dayroom, BASE_PRICES.haven.dayroom); // 620,000 unchanged

  const signature = getEffectivePrices('signature', friday);
  assert.equal(signature.isSale, true);
  assert.equal(signature.prices.combo3h, 306_000);
  assert.equal(signature.prices.overnight, 527_000);
  assert.equal(signature.prices.dayroom, BASE_PRICES.signature.dayroom); // 750,000 unchanged

  assert.equal(isSpecialDealActive(friday), true);
});

test('Promo: Saturday (2026-11-21) excludes discount (day_excluded)', () => {
  const saturday = new Date('2026-11-21T12:00:00+07:00');
  assert.equal(saturday.getDay(), 6, 'Date should be Saturday');

  const haven = getEffectivePrices('haven', saturday);
  assert.equal(haven.isSale, false);
  assert.equal(haven.reason, 'day_excluded');
  assert.deepEqual(haven.prices, BASE_PRICES.haven);

  const signature = getEffectivePrices('signature', saturday);
  assert.equal(signature.isSale, false);
  assert.equal(signature.reason, 'day_excluded');
  assert.deepEqual(signature.prices, BASE_PRICES.signature);
});

test('Promo & SpecialDeal: Holidays (2026-11-22, 23, 24) exclude discount', () => {
  const holidays = [
    '2026-11-22T12:00:00+07:00',
    '2026-11-23T12:00:00+07:00',
    '2026-11-24T12:00:00+07:00',
  ];

  for (const dateStr of holidays) {
    const d = new Date(dateStr);
    const haven = getEffectivePrices('haven', d);
    const signature = getEffectivePrices('signature', d);

    assert.equal(haven.isSale, false, `Expected no sale on ${formatYMD(d)}`);
    assert.equal(haven.reason, 'holiday_excluded');
    assert.deepEqual(haven.prices, BASE_PRICES.haven);

    assert.equal(signature.isSale, false, `Expected no sale on ${formatYMD(d)}`);
    assert.equal(signature.reason, 'holiday_excluded');
    assert.deepEqual(signature.prices, BASE_PRICES.signature);

    assert.equal(isSpecialDealActive(d), false, `Special deal should be inactive on ${formatYMD(d)}`);
  }
});

test('Promo & SpecialDeal: Active until 2026-11-30, expired from 2026-12-01', () => {
  const lastDay = new Date('2026-11-30T22:00:00+07:00'); // Monday
  assert.equal(lastDay.getDay(), 1);
  const havenLast = getEffectivePrices('haven', lastDay);
  assert.equal(havenLast.isSale, true);
  assert.equal(isSpecialDealActive(lastDay), true);

  const afterEnd = new Date('2026-12-01T12:00:00+07:00');
  const havenAfter = getEffectivePrices('haven', afterEnd);
  assert.equal(havenAfter.isSale, false);
  assert.equal(havenAfter.reason, 'expired');
  assert.equal(isSpecialDealActive(afterEnd), false);
});

