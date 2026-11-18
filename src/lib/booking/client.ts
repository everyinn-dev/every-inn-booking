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

async function svgTextToPngBlob(svgText: string): Promise<Blob | null> {
  if (typeof Image !== "undefined" && typeof document !== "undefined") {
    try {
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
      const png = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const w = (img.naturalWidth || 540) * 2;
            const h = (img.naturalHeight || 640) * 2;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve(null);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob((b) => resolve(b), "image/png");
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
      if (png) return png;
    } catch {
      /* fallback to embedded base64 png below */
    }
  }
  const m = svgText.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  if (m?.[1]) {
    const bin = atob(m[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }
  return null;
}

export async function downloadQrImage(url: string, filename: string): Promise<boolean> {
  try {
    const fetchUrl = url.includes("img.vietqr.io/") ? url.replace(/\.(png|jpg|jpeg)(?=\?|$)/i, ".svg") : url;
    const res = await fetch(fetchUrl, { mode: "cors", credentials: "omit" });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    let pngBlob: Blob | null = null;
    if (ct.includes("svg")) {
      pngBlob = await svgTextToPngBlob(await res.text());
    } else {
      const b = await res.blob();
      pngBlob = b.type === "image/png" ? b : new Blob([b], { type: "image/png" });
    }
    if (!pngBlob) return false;
    const objectUrl = URL.createObjectURL(pngBlob);
    try {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
    }
  } catch {
    return false;
  }
}
