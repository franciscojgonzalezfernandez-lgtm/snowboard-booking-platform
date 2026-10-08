import { Duration, Locale } from "@prisma/client";
import { z } from "zod";

import { attendeeSchema } from "./attendee";
import { E164 } from "./phone";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createBookingDraftSchema = z.object({
  date: z.string().regex(ISO_DATE, { message: "INVALID_DATE" }),
  time: z.string().regex(HHMM, { message: "INVALID_TIME" }),
  duration: z.nativeEnum(Duration),
  instructorId: z
    .string()
    .min(1)
    .refine((v) => v !== "ANYONE", { message: "INSTRUCTOR_NOT_RESOLVED" }),
  language: z.nativeEnum(Locale),
  bookerName: z.string().trim().min(1).max(80),
  bookerPhone: z
    .string()
    .trim()
    .transform((raw) => raw.replace(/\s+/g, ""))
    .pipe(z.string().regex(E164, { message: "INVALID_PHONE" })),
  attendees: z.array(attendeeSchema).min(1).max(4),
  notes: z.string().trim().max(500).optional().default(""),
  acceptedTerms: z.literal(true),
  // F-060: account credits the booker chose to apply at checkout. Sanity cap of
  // 10 — a booker with more than 10 active credits is pathological and the cap
  // bounds the IN-clause + the lock loop. Server re-validates ownership, ACTIVE
  // status and expiry; the array order is irrelevant (oldest-first cap is
  // applied server-side).
  creditIds: z.array(z.string().min(1)).max(10).optional(),
  // F-155: optional promo code the booker applied in the step before payment.
  // Stored normalized (uppercase) server-side; validated + priced authoritatively
  // in `createBookingDraftWith` via `resolveDiscountWith`, which bubbles a
  // PROMO_* error if it no longer applies. Kept permissive here (the code's
  // existence/shape is the server's job, not the schema's).
  discountCode: z.string().trim().min(1).max(40).optional(),
});

export type CreateBookingDraftInput = z.infer<typeof createBookingDraftSchema>;

export type CreateBookingDraftError =
  | "UNAUTHORIZED"
  // F-122: session belongs to an account whose email is not verified — refused
  // before any slot hold or PaymentIntent is created.
  | "EMAIL_NOT_VERIFIED"
  // F-122: the booker already holds the maximum number of concurrent
  // PENDING_PAYMENT drafts — bounds inventory a single actor can lock at once.
  | "TOO_MANY_HOLDS"
  | "INVALID_INPUT"
  | "NO_ACTIVE_SEASON"
  | "PRICING_MISSING"
  | "SLOT_TAKEN"
  | "CREDIT_NOT_APPLICABLE"
  // F-155: the applied promo code failed server re-validation at draft time
  // (unknown/typo, deactivated, already used by this booker, or the global cap
  // is exhausted). Mirrors the DiscountError union in lib/booking/discount.ts.
  | "PROMO_INVALID"
  | "PROMO_INACTIVE"
  | "PROMO_ALREADY_USED"
  | "PROMO_EXHAUSTED";

export type CreateBookingDraftResult =
  | {
      ok: true;
      bookingId: string;
      /**
       * Stripe client secret for the Payment Element. `null` on the zero-charge
       * path (F-060): credits fully cover the lesson, the booking is created
       * CONFIRMED with no PaymentIntent, and the client redirects straight to
       * the success page.
       */
      clientSecret: string | null;
      /** Full lesson price (ledger value = effective/charged price), independent of credits applied. */
      totalPriceCents: number;
      /** Amount actually charged to the card = max(0, total - creditsApplied). */
      chargeAmountCents: number;
      /** Sum of the credits effectively consumed (may exceed total on overshoot). */
      creditsAppliedCents: number;
      /** F-141: regular (pre-promo) price, set only when a promo applied (else null). */
      originalPriceCents: number | null;
      /** F-141: resolved promo copy in the booking's language, set only when a promo applied. */
      promoLabel: string | null;
      /** F-155: CHF cents a promo code took off the lesson (0 when none applied). */
      discountCents: number;
      /** F-155: the applied promo code (normalized), or null when none applied. */
      discountCode: string | null;
      reused: boolean;
    }
  | {
      ok: false;
      error: CreateBookingDraftError;
      issues?: z.ZodIssue[];
    };
