import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createValidator } from "./helpers/schemaValidator.mjs";

const resolve = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const cdpDoc = JSON.parse(readFileSync(resolve("../contracts/cdp-core.openapi.json"), "utf8"));
const cdpValidator = createValidator(cdpDoc);

test("Consumer contract (Landing): PublicLoyalty matches schema for found member", () => {
  const sampleFound = {
    found: true,
    phoneMasked: "09******67",
    tier: "bronze",
    lifetimeBookingCount: 3,
    nextTier: { code: "silver", remainingBookings: 2 },
    stamp: {
      status: "active",
      currentStep: 3,
      maxSteps: 10,
      startsAt: "2026-09-01T00:00:00Z",
      expiresAt: "2026-10-16T00:00:00Z",
      nextMilestoneStep: 8,
      milestones: [
        { step: 3, label: "Giảm 10%", status: "reached" },
        { step: 8, label: "Giảm 20%", status: "upcoming" },
      ],
    },
    rulesVersion: "mock-v1",
  };

  const errors = cdpValidator.validateResponse("/public-safe/v1/loyalty/lookup", "POST", 200, sampleFound);
  assert.deepEqual(errors, [], `PublicLoyalty found schema errors: ${errors.join(", ")}`);
});

test("Consumer contract (Landing): PublicLoyalty matches schema for not-found member", () => {
  const sampleNotFound = {
    found: false,
  };

  const errors = cdpValidator.validateResponse("/public-safe/v1/loyalty/lookup", "POST", 200, sampleNotFound);
  assert.deepEqual(errors, [], `PublicLoyalty not-found schema errors: ${errors.join(", ")}`);
});
