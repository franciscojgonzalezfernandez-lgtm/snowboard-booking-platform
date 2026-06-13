import { z } from "zod";

// Shared Zod schemas for the admin pricing editor (F-080). Two layers:
//
//  - `updateSeasonPricingSchema` is the *authoritative* server contract: a
//    price per Duration as a positive integer number of CHF cents. The
//    dependency-injected core in `lib/admin/pricing.ts` and the `"use server"`
//    wrapper in `app/admin/actions.ts` both validate against it. `.int()`
//    rejects floats so a malicious/buggy client can never store fractional
//    cents (CLAUDE.md: money is integer cents, never float).
//
//  - `pricingFormSchema` is the *client* contract used by React Hook Form: the
//    owner types prices in CHF francs (display). The form converts francs →
//    cents via `lib/pricing/chf.ts` before calling the action, which then
//    re-validates with the cents schema.

// 10'000 CHF defensive ceiling — a full-day private lesson is ~500 CHF; this is
// far above any real price but blocks a fat-finger that adds extra zeros.
const MAX_PRICE_CENTS = 1_000_000;

const priceCents = z
  .number()
  .int("NOT_INTEGER")
  .positive("NOT_POSITIVE")
  .max(MAX_PRICE_CENTS, "TOO_LARGE");

export const updateSeasonPricingSchema = z.object({
  ONE_HOUR: priceCents,
  TWO_HOURS: priceCents,
  INTENSIVE: priceCents,
  FULL_DAY: priceCents,
});

export type UpdateSeasonPricingInput = z.infer<typeof updateSeasonPricingSchema>;

const priceFrancs = z
  .number()
  .positive("NOT_POSITIVE")
  .max(MAX_PRICE_CENTS / 100, "TOO_LARGE");

export const pricingFormSchema = z.object({
  ONE_HOUR: priceFrancs,
  TWO_HOURS: priceFrancs,
  INTENSIVE: priceFrancs,
  FULL_DAY: priceFrancs,
});

export type PricingFormInput = z.infer<typeof pricingFormSchema>;
