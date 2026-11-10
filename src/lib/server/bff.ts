/**
 * LSB-3 — guest self-booking BFF plumbing (server only).
 *  - bindings: BOOKING_CORE (read-only storefront routes, caller `landing-bff`, web guest actor 900002) and
 *    AGENT_CORE → named entrypoint LandingApi (booking sessions, /checkin, pulse). No secret lives in the landing.
 *  - guard(): feature flag, same-origin, Workers Rate Limiting per IP (short windows; long windows are in agent-core).
 *  - envelope: { ok, data | error{code,message,details}, requestId }, always `Cache-Control: private, no-store`.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface BffEnv {
  BOOKING_CORE?: Fetcher;
  AGENT_CORE?: Fetcher;
  WEB_BOOKING_ENABLED?: string;
  LOYALTY_ENABLED?: string;
  SEARCH_RL?: RateLimit;
  HOLD_RL?: RateLimit;
  PAID_RL?: RateLimit;
  LOOKUP_RL?: RateLimit;
}

let testEnv: BffEnv | null = null;
/** Unit tests inject fake bindings (no OpenNext runtime). */
export function setBffTestEnv(env: BffEnv | null) {
  testEnv = env;
}

export async function bffEnv(): Promise<BffEnv> {
  if (testEnv) return testEnv;
  // `BOOKING_MOCK=1 next dev` — UI review without the Workers (never in production builds)
  if (process.env.NODE_ENV !== "production" && process.env.BOOKING_MOCK === "1") {
    const { mockBffEnv } = await import("./devMock");
    testEnv = mockBffEnv();
    return testEnv;
  }
  try {
    return (await getCloudflareContext({ async: true })).env as unknown as BffEnv;
  } catch {
    return {};
  }
}

export async function webBookingEnabled(): Promise<boolean> {
  const env = await bffEnv();
  const flag = env.WEB_BOOKING_ENABLED ?? (typeof process !== "undefined" ? process.env?.WEB_BOOKING_ENABLED : undefined);
  return flag === "true";
}

export async function loyaltyEnabled(): Promise<boolean> {
  const env = await bffEnv();
  const flag = env.LOYALTY_ENABLED ?? (typeof process !== "undefined" ? process.env?.LOYALTY_ENABLED : undefined);
  return flag === "true";
}

export class BffError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export function ok(data: unknown, requestId: string, status = 200, extra: Record<string, string> = {}) {
  return Response.json({ ok: true, data, requestId }, { status, headers: { ...HEADERS, ...extra } });
}

export function fail(err: unknown, requestId: string) {
  if (err instanceof BffError) {
    const headers: Record<string, string> = { ...HEADERS };
    if (err.status === 429) headers["Retry-After"] = String(err.details?.retryAfterSeconds ?? 60);
    return Response.json({ ok: false, error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }, requestId }, { status: err.status, headers });
  }
  console.error(JSON.stringify({ level: "error", msg: "bff.failed", requestId, error: String(err instanceof Error ? err.message : err).slice(0, 200) }));
  return Response.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Hệ thống đang bận, bạn thử lại sau ít phút nhé." }, requestId }, { status: 500, headers: HEADERS });
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "0.0.0.0";
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = (req as { nextUrl?: URL }).nextUrl?.host || new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Flag + same-origin + rate limit. Returns the env and a request id. */
export async function guard(req: Request, limiter?: "SEARCH_RL" | "HOLD_RL" | "PAID_RL" | "LOOKUP_RL", key?: string): Promise<{ env: BffEnv; requestId: string }> {
  const requestId = crypto.randomUUID();
  const env = await bffEnv();
  if (!(await webBookingEnabled())) throw new BffError(503, "FEATURE_DISABLED", "Đặt phòng trực tuyến hiện chưa mở. Bạn nhắn Instagram Every Inn để đặt nhé!");
  if (req.method !== "GET" && !sameOrigin(req)) throw new BffError(403, "FORBIDDEN", "Yêu cầu không hợp lệ.");
  const rl = limiter ? env[limiter] : undefined;
  if (rl) {
    const { success } = await rl.limit({ key: key ?? clientIp(req) });
    if (!success) throw new BffError(429, "RATE_LIMIT_EXCEEDED", "Bạn thao tác hơi nhanh, chờ một chút rồi thử lại nhé.", { retryAfterSeconds: 60 });
  }
  return { env, requestId };
}

async function call(binding: Fetcher | undefined, base: string, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<Response> {
  if (!binding) throw new BffError(503, "CORE_BINDING_MISSING", "Hệ thống đặt phòng tạm thời chưa sẵn sàng.");
  const headers = new Headers({ accept: "application/json", "x-ei-caller": "landing-bff", "x-request-id": crypto.randomUUID(), ...(init.headers ?? {}) });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  try {
    return await binding.fetch(new Request(`${base}${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(init.timeoutMs ?? 8000) }));
  } catch {
    throw new BffError(503, "CORE_UNAVAILABLE", "Hệ thống đặt phòng đang bận, bạn thử lại sau ít phút nhé.");
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;
    throw new BffError(res.status >= 500 ? 502 : res.status, e?.code ?? "CORE_ERROR", e?.message ?? "Có lỗi xảy ra, bạn thử lại nhé.", e?.details);
  }
  return body as T;
}

const WEB_ACTOR = { "x-ei-actor-id": "900002", "x-ei-actor-role": "receptionist", "x-ei-actor-name": encodeURIComponent("Khách web") };

/** Booking Core (read-only routes). Returns the raw Response for ETag / 304 passthrough when asked. */
export const bookingCore = {
  async get<T>(env: BffEnv, path: string, ifNoneMatch?: string | null): Promise<{ status: number; etag: string | null; data: T | null }> {
    const res = await call(env.BOOKING_CORE, "https://booking-core.internal", path, { headers: { ...WEB_ACTOR, ...(ifNoneMatch ? { "if-none-match": ifNoneMatch } : {}) } });
    if (res.status === 304) return { status: 304, etag: res.headers.get("etag"), data: null };
    return { status: res.status, etag: res.headers.get("etag"), data: await unwrap<T>(res) };
  },
  async post<T>(env: BffEnv, path: string, body: unknown): Promise<T> {
    return unwrap<T>(await call(env.BOOKING_CORE, "https://booking-core.internal", path, { method: "POST", body, headers: WEB_ACTOR }));
  },
};

/** agent-core LandingApi (booking sessions). Forwards the guest IP for anti-abuse (hashed there). */
export async function agent<T>(env: BffEnv, req: Request, method: string, path: string, body?: unknown, opts: { timeoutMs?: number; raw?: boolean } = {}): Promise<{ status: number; data: T | null; etag: string | null }> {
  const res = await call(env.AGENT_CORE, "https://agent-core.internal", path, {
    method,
    body,
    timeoutMs: opts.timeoutMs,
    headers: { "x-ei-client-ip": clientIp(req), ...(req.headers.get("if-none-match") ? { "if-none-match": req.headers.get("if-none-match")! } : {}) },
  });
  if (res.status === 304) return { status: 304, data: null, etag: res.headers.get("etag") };
  return { status: res.status, data: await unwrap<T>(res), etag: res.headers.get("etag") };
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

export async function readJson(req: Request, max = 16 * 1024): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > max) throw new BffError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
  try {
    const v = text ? JSON.parse(text) : {};
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not object");
    return v as Record<string, unknown>;
  } catch {
    throw new BffError(400, "INVALID_JSON", "Dữ liệu không hợp lệ.");
  }
}
