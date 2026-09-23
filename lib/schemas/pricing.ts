import { Duration } from "@prisma/client";
import { z } from "zod";

// Shared Zod schemas for the admin pricing editor (F-080; promotions F-141).
// Two layers:
//
//  - `updateSeasonPricingSchema` is the *authoritative* server contract: a
//    price per Duration as a positive integer number of CHF cents, plus an
//    optional per-duration promotion (integer cents + localized copy). The
//    dependency-injected core in `lib/admin/pricing.ts` and the `"use server"`
//    wrapper in `app/(ops)/admin/actions.ts` both validate against it. `.int()`
//    rejects floats so a malicious/buggy client can never store fractional
//    cents (CLAUDE.md: money is integer cents, never float).
//
//  - `pricingFormSchema` is the *client* contract used by React Hook Form: the
//    owner types prices in CHF francs (display). The form converts francs →
//    cents via `lib/pricing/chf.ts` before calling the action, which then
//    re-validates with the cents schema.
//
// The two invariants for a promotion — promo strictly below regular, and all
// three locale labels present — are enforced on BOTH layers (client for UX,
// server as the authority). `resolvePriceCents` re-checks the price invariant a
// third time on read, so even a hand-crafted DB row can never mis-price.

export const DURATIONS = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
] as const;

// 10'000 CHF defensive ceiling — a full-day private lesson is ~500 CHF; this is
// far above any real price but blocks a fat-finger that adds extra zeros.
const MAX_PRICE_CENTS = 1_000_000;

// ---------------------------------------------------------------------------
// Server contract (cents)
// ---------------------------------------------------------------------------

const priceCents = z
  .number()
  .int("NOT_INTEGER")
  .positive("NOT_POSITIVE")
  .max(MAX_PRICE_CENTS, "TOO_LARGE");

const localizedText = z.object({
  en: z.string().trim().min(1, "REQUIRED"),
  de: z.string().trim().min(1, "REQUIRED"),
  es: z.string().trim().min(1, "REQUIRED"),
});

const promoEntry = z.object({
  priceCents,
  label: localizedText,
});

export const updateSeasonPricingSchema = z
  .object({
    ONE_HOUR: priceCents,
    TWO_HOURS: priceCents,
    INTENSIVE: priceCents,
    FULL_DAY: priceCents,
    // Per-duration promotion; each key optional so a duration with no promo is
    // simply absent, and non-promo callers may omit `promos` entirely.
    promos: z
      .object({
        ONE_HOUR: promoEntry.optional(),
        TWO_HOURS: promoEntry.optional(),
        INTENSIVE: promoEntry.optional(),
        FULL_DAY: promoEntry.optional(),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    for (const duration of DURATIONS) {
      const promo = v.promos?.[duration];
      if (promo && promo.priceCents >= v[duration]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["promos", duration, "priceCents"],
          message: "PROMO_NOT_BELOW_REGULAR",
        });
      }
    }
  });

export type UpdateSeasonPricingInput = z.infer<typeof updateSeasonPricingSchema>;

// ---------------------------------------------------------------------------
// Client contract (francs)
// ---------------------------------------------------------------------------

const priceFrancs = z
  .number()
  .positive("NOT_POSITIVE")
  .max(MAX_PRICE_CENTS / 100, "TOO_LARGE");

const promoFormEntry = z.object({
  // Optional: absent means this duration is not promoted. The form's `register`
  // uses `setValueAs` to map an empty number input (NaN) to `undefined`, so this
  // stays a plain optional number (input and output types match — no preprocess).
  price: priceFrancs.optional(),
  // Always present in the form (three text inputs). Required-ness is conditional
  // on `price` being set, enforced in superRefine below.
  label: z.object({
    en: z.string(),
    de: z.string(),
    es: z.string(),
  }),
});

export const pricingFormSchema = z
  .object({
    ONE_HOUR: priceFrancs,
    TWO_HOURS: priceFrancs,
    INTENSIVE: priceFrancs,
    FULL_DAY: priceFrancs,
    promos: z.object({
      ONE_HOUR: promoFormEntry,
      TWO_HOURS: promoFormEntry,
      INTENSIVE: promoFormEntry,
      FULL_DAY: promoFormEntry,
    }),
  })
  .superRefine((v, ctx) => {
    for (const duration of DURATIONS) {
      const promo = v.promos[duration];
      if (promo.price == null) continue; // no promo → labels irrelevant
      if (promo.price >= v[duration]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["promos", duration, "price"],
          message: "PROMO_NOT_BELOW_REGULAR",
        });
      }
      for (const locale of ["en", "de", "es"] as const) {
        if (promo.label[locale].trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["promos", duration, "label", locale],
            message: "PROMO_LABEL_REQUIRED",
          });
        }
      }
    }
  });

export type PricingFormInput = z.infer<typeof pricingFormSchema>;
