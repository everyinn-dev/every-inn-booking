"use client";
/** Browser-side helpers for the guest booking flow (LSB-4). */
import { ROOMS } from "@/data/rooms";
import { errorText } from "@/shared/booking-kit/format";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

export async function api<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { code: string; message: string; details?: Record<string, unknown> } } | null;
    if (res.ok && json?.ok) return { ok: true, status: res.status, data: json.data };
    const e = json?.error ?? { code: `HTTP_${res.status}`, message: "Có lỗi xảy ra, bạn thử lại nhé." };
    return { ok: false, status: res.status, error: { ...e, message: errorText(e.code, e.message) } };
  } catch {
    return { ok: false, status: 0, error: { code: "NETWORK", message: "Mất kết nối mạng, bạn kiểm tra lại rồi thử lại nhé." } };
  }
}

/** Landing photos / room facts by room number (Core room ids are haven-101…, landing ids signature-102…). */
export function roomMedia(roomNumber: string) {
  const r = ROOMS.find((x) => x.roomNumber === roomNumber);
  return r ? { image: r.images.thumbnail, gallery: r.images.gallery, bed: r.bedType, area: r.area, slug: r.id, shortDesc: r.shortDesc } : { image: "", gallery: [], bed: "", area: null, slug: null, shortDesc: "" };
}

export const newNonce = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 24);

/** The hold this browser is working on (one live hold per guest; shared between tabs). */
const KEY = "ei.activeHold";
export interface ActiveHold {
  token: string;
  roomLabel: string;
  expiresAt: string;
}
export function readActiveHold(): ActiveHold | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as ActiveHold | null;
    return v && Date.parse(v.expiresAt) > Date.now() ? v : null;
  } catch {
    return null;
  }
}
export function writeActiveHold(v: ActiveHold | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
    new BroadcastChannel("ei-booking").postMessage({ type: "hold", value: v });
  } catch {
    /* private mode */
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
