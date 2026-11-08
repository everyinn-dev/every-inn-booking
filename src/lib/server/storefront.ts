/** Storefront master data, cached per isolate for 60 s (master data only — CONVENTIONS §4). */
import type { Storefront } from "@/shared/booking-kit/types";
import { bookingCore, type BffEnv } from "./bff";

let cache: { at: number; value: Storefront; etag: string | null } | null = null;

export async function storefront(env: BffEnv): Promise<{ value: Storefront; etag: string | null }> {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const r = await bookingCore.get<Storefront>(env, "/internal/v1/storefront", cache?.etag ?? null);
  if (r.status === 304 && cache) {
    cache = { ...cache, at: Date.now() };
    return cache;
  }
  cache = { at: Date.now(), value: r.data!, etag: r.etag };
  return cache;
}

export function resetStorefrontCache() {
  cache = null;
}
