import { BookingStatus } from "@prisma/client";

import type { Db } from "@/lib/db";

// F-155 promo/discount codes — the single source of truth for "does this code
// apply and how much does it take off", reused by BOTH the live preview
// (`validateDiscountCode` action) and the authoritative draft
// (`createBookingDraftWith`). Pure + dependency-injected (a `prisma` surface)
// so Vitest can drive it with a fake client, exactly like the credit helpers.
//
// Designed to extend to referral codes later: `resolveDiscountWith` already
// keys enforcement off `Booking.discountCodeId`, so a referrer reward just
// needs a webhook hook on CONFIRMED — no reshape here.

/**
 * Booking statuses that count as a live redemption of a code. A booking in one
 * of these carries the code and consumes it (for both the once-per-customer
 * rule and the optional global cap). Cancelled / failed / refunded bookings do
 * NOT count, so an abandoned PENDING_PAYMENT draft frees the code again once the
 * expiry cron flips it to CANCELLED_BY_SYSTEM — the booker can retry.
 */
export const REDEEMED_DISCOUNT_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

export type DiscountDeps = {
  prisma: Db;
};

export type DiscountError =
  | "PROMO_INVALID"
  | "PROMO_INACTIVE"
  | "PROMO_ALREADY_USED"
  | "PROMO_EXHAUSTED";

/** The code fields a caller needs to persist / display after resolution. */
export type ResolvedDiscountCode = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
};

export type ResolveDiscountResult =
  | { ok: true; code: ResolvedDiscountCode; discountCents: number }
  | { ok: false; error: DiscountError };

/** Trim + uppercase a raw booker input to the canonical stored form. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * CHF-cents a code takes off a lesson priced `totalPriceCents`.
 *
 * Percentage FLOORS so a fractional cent is never over-discounted; a fixed
 * amount is CLAMPED to the price so the charge can never go negative. A
 * malformed code (neither field set — forbidden by the admin schema) yields 0,
 * defensively. Never returns more than `totalPriceCents`.
 */
export function computeDiscountCents(
  code: Pick<ResolvedDiscountCode, "percentOff" | "amountOffCents">,
  totalPriceCents: number,
): number {
  if (totalPriceCents <= 0) return 0;
  if (code.percentOff != null) {
    const pct = Math.max(0, Math.min(100, code.percentOff));
    return Math.min(totalPriceCents, Math.floor((totalPriceCents * pct) / 100));
  }
  if (code.amountOffCents != null) {
    return Math.max(0, Math.min(totalPriceCents, code.amountOffCents));
  }
  return 0;
}

/**
 * Validate a booker's promo code against the active rules and compute the
 * discount for a lesson priced `totalPriceCents` (the EFFECTIVE, promo-aware
 * price — see `resolvePriceCents`). Enforcement is entirely server-side:
 *   - the code exists and is `active`
 *   - once-per-customer (always): no non-cancelled booking of this booker
 *     already carries the code
 *   - optional global cap: non-cancelled bookings carrying the code must be
 *     below `maxRedemptions` (null = unlimited)
 *
 * The count-then-write is not fully serialized against a concurrent draft, an
 * accepted trade-off for a single-instructor MVP (very low concurrency); the
 * unique nature of the per-customer limit makes a real double-redeem by one
 * person practically impossible in the funnel (one active hold at a time).
 */
export async function resolveDiscountWith(
  deps: DiscountDeps,
  input: { codeInput: string; userId: string; totalPriceCents: number },
): Promise<ResolveDiscountResult> {
  const normalized = normalizeCode(input.codeInput);
  if (normalized.length === 0) return { ok: false, error: "PROMO_INVALID" };

  const code = await deps.prisma.discountCode.findUnique({
    where: { code: normalized },
    select: {
      id: true,
      code: true,
      percentOff: true,
      amountOffCents: true,
      maxRedemptions: true,
      active: true,
    },
  });
  if (!code) return { ok: false, error: "PROMO_INVALID" };
  if (!code.active) return { ok: false, error: "PROMO_INACTIVE" };

  // Once-per-customer (always enforced).
  const alreadyUsed = await deps.prisma.booking.count({
    where: {
      bookerId: input.userId,
      discountCodeId: code.id,
      status: { in: REDEEMED_DISCOUNT_STATUSES },
    },
  });
  if (alreadyUsed > 0) return { ok: false, error: "PROMO_ALREADY_USED" };

  // Optional global cap.
  if (code.maxRedemptions != null) {
    const total = await deps.prisma.booking.count({
      where: { discountCodeId: code.id, status: { in: REDEEMED_DISCOUNT_STATUSES } },
    });
    if (total >= code.maxRedemptions) {
      return { ok: false, error: "PROMO_EXHAUSTED" };
    }
  }

  return {
    ok: true,
    code: {
      id: code.id,
      code: code.code,
      percentOff: code.percentOff,
      amountOffCents: code.amountOffCents,
    },
    discountCents: computeDiscountCents(code, input.totalPriceCents),
  };
}
