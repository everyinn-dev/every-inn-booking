/**
 * booking-kit / live — SOURCE OF TRUTH: everyinn-platform-docs/shared/booking-kit/ (synced; edit here only).
 *
 * Headless realtime hooks (React 19) shared by the landing page and the admin wizard:
 *  - useLongPoll: follows a versioned resource through a long-poll endpoint (200 = changed, 304 = unchanged).
 *    Only while the tab is visible; an immediate re-check when it becomes visible again; on network errors it
 *    falls back to short polling (4 s → 30 s backoff). Re-renders only when the version moves.
 *  - useServerCountdown: a countdown that trusts the SERVER clock (serverNow + expiresAt), not the device's.
 */
"use client";
import { useEffect, useRef, useState } from "react";

export function useLongPoll<T extends { version: number }>(opts: {
  /** builds the URL for "anything newer than version v?" */
  url: (v: number) => string | null;
  initial: T | null;
  /** picks the resource out of a 200 body */
  pick: (body: unknown) => T | null;
  enabled?: boolean;
}): { data: T | null; online: boolean; setData: (d: T) => void } {
  const [data, setData] = useState<T | null>(opts.initial);
  const [online, setOnline] = useState(true);
  const ref = useRef({ version: opts.initial?.version ?? 0, url: opts.url, pick: opts.pick });
  useEffect(() => {
    ref.current.url = opts.url;
    ref.current.pick = opts.pick;
  });
  useEffect(() => {
    if (data && data.version > ref.current.version) ref.current.version = data.version;
  }, [data]);

  useEffect(() => {
    if (opts.enabled === false) return;
    let stop = false;
    let backoff = 4_000;
    let ctrl: AbortController | null = null;
    let wake: (() => void) | null = null;
    const sleep = (ms: number) => new Promise<void>((r) => {
      const t = setTimeout(r, ms);
      wake = () => {
        clearTimeout(t);
        r();
      };
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") wake?.();
      else ctrl?.abort();
    };
    document.addEventListener("visibilitychange", onVisible);
    (async () => {
      while (!stop) {
        if (document.visibilityState !== "visible") {
          await sleep(60_000);
          continue;
        }
        const url = ref.current.url(ref.current.version);
        if (!url) return;
        ctrl = new AbortController();
        try {
          const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
          if (res.status === 200) {
            const next = ref.current.pick(await res.json());
            if (next && next.version > ref.current.version) {
              ref.current.version = next.version;
              setData(next);
            }
          } else if (res.status !== 304) throw new Error(String(res.status));
          setOnline(true);
          backoff = 4_000;
        } catch {
          if (stop) return;
          setOnline(false);
          await sleep(backoff);
          backoff = Math.min(30_000, backoff * 2);
        }
      }
    })();
    return () => {
      stop = true;
      ctrl?.abort();
      wake?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [opts.enabled]);

  return {
    data,
    online,
    setData: (d: T) => {
      ref.current.version = Math.max(ref.current.version, d.version);
      setData(d);
    },
  };
}

/** Seconds left until `expiresAt`, corrected by the skew between the device clock and `serverNow`. */
export function useServerCountdown(expiresAt: string | null | undefined, serverNow: string | null | undefined): number {
  const [left, setLeft] = useState(() => (expiresAt ? Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)) : 0));
  useEffect(() => {
    if (!expiresAt) return;
    const skew = serverNow ? Date.parse(serverNow) - Date.now() : 0;
    const tick = () => setLeft(Math.max(0, Math.floor((Date.parse(expiresAt) - (Date.now() + skew)) / 1000)));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [expiresAt, serverNow]);
  return expiresAt ? left : 0;
}
