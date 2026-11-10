import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";
import { loyaltyEnabled, setBffTestEnv, webBookingEnabled } from "../src/lib/server/bff.ts";

const resolve = (rel) => fileURLToPath(new URL(rel, import.meta.url));

function stripJsonc(text) {
  let out = "";
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inStr) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
      } else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

beforeEach(() => {
  setBffTestEnv(null);
});

describe("production gating invariants", () => {
  it("wrangler.jsonc disables self-booking & loyalty in production and enables both in env.dev", () => {
    const cfg = JSON.parse(stripJsonc(readFileSync(resolve("../wrangler.jsonc"), "utf8")));
    assert.equal(cfg.vars?.WEB_BOOKING_ENABLED, "false");
    assert.equal(cfg.vars?.LOYALTY_ENABLED, "false");
    assert.equal(cfg.env?.dev?.vars?.WEB_BOOKING_ENABLED, "true");
    assert.equal(cfg.env?.dev?.vars?.LOYALTY_ENABLED, "true");
  });

  it("webBookingEnabled() and loyaltyEnabled() fail closed when unset or false", async () => {
    for (const val of [undefined, "false", "0", ""]) {
      setBffTestEnv({ WEB_BOOKING_ENABLED: val, LOYALTY_ENABLED: val });
      assert.equal(await webBookingEnabled(), false, `expected webBookingEnabled()=false for ${String(val)}`);
      assert.equal(await loyaltyEnabled(), false, `expected loyaltyEnabled()=false for ${String(val)}`);
    }
    setBffTestEnv({ WEB_BOOKING_ENABLED: "true", LOYALTY_ENABLED: "true" });
    assert.equal(await webBookingEnabled(), true);
    assert.equal(await loyaltyEnabled(), true);
  });

  it("self-booking routes call notFound() and never render a coming-soon screen", () => {
    assert.equal(existsSync(resolve("../src/components/booking/Disabled.tsx")), false);
    for (const rel of [
      "../src/app/dat-phong/page.tsx",
      "../src/app/dat-phong/[token]/page.tsx",
      "../src/app/checkin/page.tsx",
    ]) {
      const src = readFileSync(resolve(rel), "utf8");
      assert.match(src, /export const dynamic = ["']force-dynamic["']/);
      assert.match(src, /notFound\(\)/);
      assert.doesNotMatch(src, /Disabled/);
    }
  });

  it("home, room detail, Header, and Footer gate self-booking and loyalty dynamically from env", () => {
    const home = readFileSync(resolve("../src/app/page.tsx"), "utf8");
    assert.match(home, /export const dynamic = ["']force-dynamic["']/);
    assert.match(home, /bookingOn && <HomeBooking \/>/);
    assert.match(home, /<Header showSelfBooking=\{bookingOn\} \/>/);
    assert.match(home, /<Footer showSelfBooking=\{bookingOn\} \/>/);
    assert.match(home, /<LoyaltyLookup comingSoon=\{!loyaltyOn\} \/>/);

    const room = readFileSync(resolve("../src/app/room/[id]/page.tsx"), "utf8");
    assert.match(room, /export const dynamic = ["']force-dynamic["']/);
    assert.match(room, /<Header showSelfBooking=\{bookingOn\} \/>/);
    assert.match(room, /<Footer showSelfBooking=\{bookingOn\} \/>/);

    const header = readFileSync(resolve("../src/components/Header.tsx"), "utf8");
    assert.match(header, /showSelfBooking = false/);
    assert.match(header, /\{showSelfBooking && <Link href="\/dat-phong"/);
    assert.match(header, /\{showSelfBooking && <Link href="\/checkin"/);

    const footer = readFileSync(resolve("../src/components/Footer.tsx"), "utf8");
    assert.match(footer, /showSelfBooking = false/);
    assert.match(footer, /\{showSelfBooking && <Link href="\/checkin"/);
  });
});
