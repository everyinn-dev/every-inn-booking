/**
 * booking-kit / types — SOURCE OF TRUTH: everyinn-platform-docs/shared/booking-kit/ (synced; edit here only).
 * Narrow views of the Booking Core storefront / availability and the agent-core booking-session DTOs
 * (contracts: booking-core.openapi.json, agent-landing.openapi.json, agent-core.openapi.json).
 */
import type { OvernightShift } from "./stay";

export interface Storefront {
  catalogVersion: number;
  bank: { bankId: string | null; account: string | null; holderName: string | null } | null;
  rooms: { id: string; roomNumber: string; name: string; roomClass: "haven" | "signature"; floor: number; areaSqm: number | null; maxGuests: number }[];
  rates: Record<"haven" | "signature", { combo3h: number | null; overnight: number | null; dayroom: number | null; extraHourFee: number }>;
  extraGuest: { standardGuests: number; feePerGuest: number; roomClasses: string[] };
  hourly: { minHours: number; firstCheckin: string; lastCheckin: string; slots: number[] };
  overnight: { window_start: string; window_end: string; max_addon_hours: number; shifts: OvernightShift[] };
  dayuse: { checkin: string; checkout: string };
  bookingWindow: { today: string; maxAdvanceDays: number; maxDate: string; minLeadMinutes: number };
  publicPromotions: { id: string; name: string; discountType: "percentage" | "fixed_amount"; discountValue: number; description: string | null }[];
}

export interface AddonOption {
  hours: number;
  type: "early_checkin" | "late_checkout";
  shortLabel: string;
  label: string;
  effectiveTimeIso: string;
  surchargeVnd: number;
  available: boolean;
  unavailableReason?: string;
}

export interface SearchRoom {
  room: { id: string; roomNumber: string; name: string; roomClass: "haven" | "signature"; maxGuests: number; areaSqm: number | null; floor: number };
  available: boolean;
  reasons: { code: string; message: string }[];
  price: { basePrice: number; subtotal: number; extraGuestFee: number; extraFee: number; holidaySurcharge: number; total?: number; promotion?: { name: string; discount: number } | null; lines: { code: string; label: string; amount: number }[] } | null;
  overnightAddons?: { shift: string; maxEarlyAllowedByRule: number; maxLateAllowedByRule: number; surchargePerHour: number; earlyCheckinOptions: AddonOption[]; lateCheckoutOptions: AddonOption[] } | null;
}

export interface SearchResult {
  bookingsVersion: number;
  checkinAt: string;
  checkoutAt: string;
  bookingWindow: { maxAdvanceDays: number; maxDate: string };
  warnings?: { code: string; message: string }[];
  shiftSummary?: { code: string; label: string; checkinAt: string; checkoutAt: string; availableRooms: number; past: boolean }[];
  rooms: SearchRoom[];
}

export type SessionStatus = "holding" | "awaiting_payment" | "payment_claimed" | "underpaid" | "confirming" | "confirmed" | "expired" | "cancelled" | "late_payment" | "conflict";

export interface SessionView {
  ref: string;
  channel: "web" | "admin" | "chat";
  status: SessionStatus;
  statusLabel: string;
  room: { id: string; label: string };
  bookingType: string;
  shift: string | null;
  checkinAt: string;
  checkoutAt: string;
  earlyHours: number;
  lateHours: number;
  numGuests: number;
  expiresAt: string;
  serverNow: string;
  remainingSeconds: number;
  amountDue: number;
  paidAmount: number;
  remaining: number;
  pricing: { basePrice: number | null; subtotal: number; promotion: { name: string; discount: number } | null; voucher: { codeMasked: string; label: string; discount: number } | null; total: number; payable: number; isDeposit: boolean } | null;
  guest: { name: string | null; phoneMasked: string | null; phone?: string | null; zalo?: string | null; instagram: string | null; facebook: string | null; note: string | null } | null;
  payment: { bankId: string | null; account: string | null; holderName: string | null; amount: number; reference: string; qrUrl: string | null } | null;
  bookingId: string | null;
  can: { editGuest: boolean; claimPaid: boolean; cancel: boolean };
  timeline: { event: string; label: string; at: string }[];
  version: number;
}

export interface Preview {
  pricing: { basePrice: number; surcharges: number; lines: { code: string; label: string; amount: number }[]; subtotal: number; promotion: { name: string | null; eligible: boolean; reason: string | null; discount: number } | null; voucher: { id: string; codeMasked: string; label: string; discount: number } | null; total: number };
  member: { tier: string | null; found: boolean | null } | null;
  vouchers: { id: string; codeMasked: string; value: number; label: string; expiresAt: string; code?: string | null }[];
}

export const LIVE_STATUSES: SessionStatus[] = ["holding", "awaiting_payment", "payment_claimed", "underpaid"];
export const TIER_LABEL: Record<string, string> = { not_member: "Khách mới", bronze: "Hội viên Đồng", silver: "Hội viên Bạc", gold: "Hội viên Vàng" };
