import {
  BookingStatus,
  CreditReason,
  CreditStatus,
  type Duration,
} from "@prisma/client";

import { setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";
import type { Db } from "@/lib/db";

/** Re-emitted credit validity for an ops-cancel (ADR-008 / F-078): one year
 * anchored on the cancelled lesson start, mirroring the user-cancel credit
 * (`lib/booking/cancel.ts`). The booker shouldn't lose remaining validity
 * because the school cancelled — anchoring on the lesson keeps the credit
 * usable for at least a year past the originally-scheduled date. */
export const OPS_CREDIT_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

/** Statuses an admin is allowed to ops-cancel from. Mirrors the surface that
 * `app/admin/bookings/[id]/page.tsx` (F-077) shows the action for. Anything
 * else (already cancelled, refunded, payment failed) is rejected. */
const OPS_CANCELABLE_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.COMPLETED,
] as const;

export type CancelBookingByOpsInput = {
  bookingId: string;
  reason?: string;
};

export type StripeRefundFn = (args: {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
}) => Promise<{ id: string }>;

export type CancelBookingByOpsDeps = {
  /** Pre-resolved admin context. The thin Server Action wrapper has already
   * called `requireAdmin()` — this only needs the admin user id for audit. */
  adminUserId: string;
  prisma: Db;
  /** Stripe refund call — injected so unit tests can drive the cash path
   * without hitting the real API. Production wires `stripe.refunds.create`. */
  stripeRefund: StripeRefundFn;
  /** Reference clock — tests inject a fixed Date, production passes new Date(). */
  now?: Date;
};

export type CancelBookingByOpsResult =
  | {
      ok: true;
      outcome: "cash" | "credit" | "mixed" | "no_charge";
      cashRefundedCents: number;
      stripeRefundId: string | null;
      creditReEmittedCents: number;
      creditExpiresAt: Date | null;
      duration: Duration;
      date: Date;
      bookerId: string;
    }
  | {
      ok: true;
      outcome: "already_cancelled";
      bookerId: string;
    }
  | {
      ok: false;
      error: "NOT_FOUND" | "FORBIDDEN_STATUS";
    };

/**
 * Pure ops-cancel logic (F-078, ADR-008). The thin Server Action wrapper in
 * `app/admin/actions.ts` resolves the admin session via `requireAdmin()` and
 * dispatches the ops-cancel emails after this returns; all DB + Stripe
 * decisions live here so they can be unit-tested without the framework.
 *
 * Policy (ADR-008):
 *   - Cash portion (`chargeAmountCents` actually captured per `paidAt`) →
 *     issue a Stripe refund for that amount. Idempotent via the per-booking
 *     idempotency key so a retried admin click never double-refunds.
 *   - Credit portion (`creditsAppliedCents`) → MINT a fresh `AccountCredit`
 *     with `reason = OPS_CANCEL`, valid one year anchored on the lesson
 *     start. The original USED credits stay USED for audit history.
 *   - PENDING_PAYMENT booking → release any LOCKED credits back to ACTIVE.
 *     No Stripe call (never paid), no fresh credit minted (nothing to
 *     convert; the booker didn't lose anything).
 *
 * Idempotency: a second call sees `status === CANCELLED_BY_OPS` and returns
 * `outcome: "already_cancelled"` without re-hitting Stripe or the DB. The
 * gated `updateMany(where: { id, status IN cancellable })` inside the
 * transaction also protects against a race with a concurrent flip — second
 * writer matches 0 rows and the credit re-emit is rolled back.
 *
 * Order of operations:
 *   1. Resolve booking. Reject if not found or status not in cancellable set.
 *   2. If already CANCELLED_BY_OPS → short-circuit (no Stripe, no DB writes).
 *   3. Cash path: call Stripe refunds.create with Idempotency-Key
 *      `ops-refund-${bookingId}`. Stripe returns the same refund on retry.
 *   4. Single `$transaction`: flip status (gated), re-emit credit / release
 *      LOCKED credits.
 *   5. Outside the transaction (Stripe metadata only): persist
 *      `stripeRefundId` / `refundedAt` / `refundAmountCents`.
 */
export async function cancelBookingByOpsWith(
  deps: CancelBookingByOpsDeps,
  input: CancelBookingByOpsInput,
): Promise<CancelBookingByOpsResult> {
  const { prisma } = deps;
  const now = deps.now ?? new Date();

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      bookerId: true,
      status: true,
      date: true,
      anchorTime: true,
      duration: true,
      totalPriceCents: true,
      chargeAmountCents: true,
      creditsAppliedCents: true,
      stripePaymentIntentId: true,
      paidAt: true,
      stripeRefundId: true,
    },
  });
  if (!booking) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (booking.status === BookingStatus.CANCELLED_BY_OPS) {
    return {
      ok: true,
      outcome: "already_cancelled",
      bookerId: booking.bookerId,
    };
  }
  if (!OPS_CANCELABLE_STATUSES.includes(booking.status as never)) {
    return { ok: false, error: "FORBIDDEN_STATUS" };
  }

  // Cash portion: only money actually captured by Stripe earns a refund.
  // `chargeAmountCents` is the net charge persisted at draft creation
  // (F-084); pre-F-084 rows fall back to `totalPriceCents`. `paidAt` gates
  // the actual capture — a PENDING_PAYMENT row never paid has none.
  const chargeAmount = booking.chargeAmountCents ?? booking.totalPriceCents;
  const hasCashCapture =
    booking.status !== BookingStatus.PENDING_PAYMENT &&
    booking.paidAt !== null &&
    booking.stripePaymentIntentId !== null &&
    chargeAmount > 0;

  // Credit portion: value redeemed against this booking at checkout.
  // Re-emitted as a fresh OPS_CANCEL credit. Original USED rows are kept
  // for audit; the booker sees the new credit in their balance.
  const creditsApplied = booking.creditsAppliedCents ?? 0;

  let stripeRefundId: string | null = booking.stripeRefundId;
  let cashRefundedCents = 0;
  if (hasCashCapture && booking.stripeRefundId === null) {
    // Idempotency-Key is per-booking-cancellation: a retried admin click
    // hits Stripe with the same key and Stripe returns the existing refund
    // instead of creating a duplicate.
    const refund = await deps.stripeRefund({
      paymentIntentId: booking.stripePaymentIntentId!,
      amountCents: chargeAmount,
      idempotencyKey: `ops-refund-${booking.id}`,
    });
    stripeRefundId = refund.id;
    cashRefundedCents = chargeAmount;
  } else if (hasCashCapture) {
    // Stripe refund already done from a prior attempt that failed before
    // the DB flip. Reuse the saved refund id, no second Stripe call.
    cashRefundedCents = chargeAmount;
  }

  const startDateTime = setUtcTime(
    startOfUtcDay(booking.date),
    booking.anchorTime,
  );
  const creditExpiresAt = new Date(
    startDateTime.getTime() + OPS_CREDIT_VALIDITY_MS,
  );

  let txOutcome: "flipped" | "already_cancelled";
  try {
    txOutcome = await prisma.$transaction(async (tx) => {
      const flipped = await tx.booking.updateMany({
        where: { id: booking.id, status: { in: [...OPS_CANCELABLE_STATUSES] } },
        data: {
          status: BookingStatus.CANCELLED_BY_OPS,
          cancelledByOpsAt: now,
          opsReason: input.reason ?? null,
        },
      });
      if (flipped.count === 0) {
        // Another writer beat us to the flip between the read above and
        // this update. Surface as already-cancelled so the caller knows
        // not to dispatch the email again.
        return "already_cancelled";
      }

      if (booking.status === BookingStatus.PENDING_PAYMENT) {
        // Released LOCKED credits — there was no capture, no fresh credit
        // to mint (nothing was converted). Mirrors the forfeit path of
        // user-cancel, but here it's not a forfeit: there was no money.
        await tx.accountCredit.updateMany({
          where: {
            lockedByBookingId: booking.id,
            status: CreditStatus.LOCKED,
          },
          data: { status: CreditStatus.ACTIVE, lockedByBookingId: null },
        });
      } else if (creditsApplied > 0) {
        await tx.accountCredit.create({
          data: {
            userId: booking.bookerId,
            amountCents: creditsApplied,
            sourceBookingId: booking.id,
            reason: CreditReason.OPS_CANCEL,
            status: CreditStatus.ACTIVE,
            expiresAt: creditExpiresAt,
          },
        });
      }

      return "flipped";
    });
  } catch (err) {
    throw err;
  }

  if (txOutcome === "already_cancelled") {
    return {
      ok: true,
      outcome: "already_cancelled",
      bookerId: booking.bookerId,
    };
  }

  // Persist Stripe metadata last — the row is already CANCELLED_BY_OPS so
  // a crash here leaves a recoverable state (status correct, refund id
  // missing). A retry sees the existing refund via the idempotency key.
  if (cashRefundedCents > 0 && stripeRefundId !== null) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        stripeRefundId,
        refundedAt: now,
        refundAmountCents: cashRefundedCents,
      },
    });
  }

  // A PENDING_PAYMENT row never had a captured payment or a USED credit, so
  // neither column on the result is meaningful — collapse to `no_charge`.
  const creditReEmittedCents =
    booking.status === BookingStatus.PENDING_PAYMENT ? 0 : creditsApplied;

  const outcome: "cash" | "credit" | "mixed" | "no_charge" =
    cashRefundedCents > 0 && creditReEmittedCents > 0
      ? "mixed"
      : cashRefundedCents > 0
        ? "cash"
        : creditReEmittedCents > 0
          ? "credit"
          : "no_charge";

  return {
    ok: true,
    outcome,
    cashRefundedCents,
    stripeRefundId,
    creditReEmittedCents,
    creditExpiresAt: creditReEmittedCents > 0 ? creditExpiresAt : null,
    duration: booking.duration,
    date: booking.date,
    bookerId: booking.bookerId,
  };
}
