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
});

export type CreateBookingDraftInput = z.infer<typeof createBookingDraftSchema>;

export type CreateBookingDraftError =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "NO_ACTIVE_SEASON"
  | "PRICING_MISSING"
  | "SLOT_TAKEN"
  | "CREDIT_NOT_APPLICABLE";

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
      /** Full lesson price (ledger value), independent of credits applied. */
      totalPriceCents: number;
      /** Amount actually charged to the card = max(0, total - creditsApplied). */
      chargeAmountCents: number;
      /** Sum of the credits effectively consumed (may exceed total on overshoot). */
      creditsAppliedCents: number;
      reused: boolean;
    }
  | {
      ok: false;
      error: CreateBookingDraftError;
      issues?: z.ZodIssue[];
    };
