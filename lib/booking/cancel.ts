import {
  BookingStatus,
  CreditReason,
  CreditStatus,
  type Duration,
} from "@prisma/client";

import { setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";

/** Free-cancellation cutoff (F-039b). At or beyond this many hours before the
 * lesson start we issue a credit; inside it the lesson fee is forfeited. */
export const CREDIT_WINDOW_HOURS = 48;

/** Credit validity (F-039b): one year from the cancellation moment. */
export const CREDIT_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

/** Statuses a booker is allowed to self-cancel from. A row in any other state
 * (already cancelled, refunded, completed, system-cancelled, payment failed)
 * is not actionable and is rejected as a conflict. */
const CANCELABLE_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING_PAYMENT,
] as const;

export type CancelBookingByUserInput = {
  bookingId: string;
};

type BookingRowForCancel = {
  id: string;
  bookerId: string;
  status: BookingStatus;
  date: Date;
  anchorTime: string;
  duration: Duration;
  totalPriceCents: number;
};

export type CancelBookingByUserDeps = {
  /** Pre-resolved session from the framework; null if anonymous. */
  session: { user: { id: string } } | null;
  prisma: PrismaSurface;
  /** Reference clock — tests inject a fixed Date, production passes new Date(). */
  now?: Date;
};

type PrismaSurface = {
  booking: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        bookerId: true;
        status: true;
        date: true;
        anchorTime: true;
        duration: true;
        totalPriceCents: true;
      };
    }): Promise<BookingRowForCancel | null>;
  };
  $transaction<T>(cb: (tx: TransactionSurface) => Promise<T>): Promise<T>;
};

type RestoredCreditRow = { id: string; amountCents: number; expiresAt: Date };

type TransactionSurface = {
  booking: {
    updateMany(args: {
      where: { id: string; status: { in: readonly BookingStatus[] } };
      data: { status: BookingStatus; cancelledByUserAt: Date };
    }): Promise<{ count: number }>;
  };
  accountCredit: {
    findMany(args: {
      where: { usedOnBookingId: string; status: CreditStatus };
      select: { id: true; amountCents: true; expiresAt: true };
    }): Promise<RestoredCreditRow[]>;
    updateMany(args: {
      where:
        | { id: { in: string[] }; status: CreditStatus }
        | { lockedByBookingId: string; status: CreditStatus };
      data:
        | { status: CreditStatus; usedAt: null; usedOnBookingId: null }
        | { status: CreditStatus; lockedByBookingId: null };
    }): Promise<{ count: number }>;
    create(args: {
      data: {
        userId: string;
        amountCents: number;
        sourceBookingId: string;
        reason: CreditReason;
        status: CreditStatus;
        expiresAt: Date;
      };
    }): Promise<{ id: string }>;
  };
};

export type CancelBookingByUserResult =
  | {
      ok: true;
      outcome: "credit";
      hoursBeforeStart: number;
      creditAmountCents: number;
      creditExpiresAt: Date;
      duration: Duration;
      date: Date;
    }
  | {
      ok: true;
      outcome: "forfeit";
      hoursBeforeStart: number;
      duration: Duration;
      date: Date;
    }
  | {
      ok: false;
      error: "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN" | "ALREADY_CANCELLED";
    };

/**
 * Pure user-cancel logic (F-058). The thin Server Action wrapper resolves the
 * session and dispatches cancellation emails (F-063) after this returns; all
 * DB decisions live here so they can be unit-tested without the framework.
 *
 * Policy (F-039b):
 *   - `hoursBeforeStart >= 48` AND the booking was actually paid (CONFIRMED)
 *     → credit path: mark CANCELLED_BY_USER + mint an AccountCredit equal to
 *     the lesson price, valid one year.
 *   - otherwise → forfeit path: mark CANCELLED_BY_USER, no credit.
 *
 * A never-paid PENDING_PAYMENT row never earns a credit regardless of the
 * window — there is no money to convert, and crediting it would let a booker
 * mint free CHF by drafting + self-cancelling. The dashboard only exposes the
 * Cancel control on CONFIRMED (upcoming) rows, so this guard is a server-side
 * safety net against a direct action call.
 *
 * Concurrency: both paths gate the status flip on `status IN (CONFIRMED,
 * PENDING_PAYMENT)` inside the write, so a double-click (or a webhook flipping
 * the row first) makes the second writer match 0 rows → ALREADY_CANCELLED,
 * and on the credit path the surrounding transaction never mints the credit.
 */
export async function cancelBookingByUserWith(
  deps: CancelBookingByUserDeps,
  input: CancelBookingByUserInput,
): Promise<CancelBookingByUserResult> {
  const { session, prisma } = deps;
  const now = deps.now ?? new Date();

  if (!session?.user) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

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
    },
  });
  if (!booking) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (booking.bookerId !== session.user.id) {
    return { ok: false, error: "FORBIDDEN" };
  }
  if (!CANCELABLE_STATUSES.includes(booking.status as never)) {
    return { ok: false, error: "ALREADY_CANCELLED" };
  }

  const startDateTime = setUtcTime(
    startOfUtcDay(booking.date),
    booking.anchorTime,
  );
  const hoursBeforeStart =
    (startDateTime.getTime() - now.getTime()) / (60 * 60 * 1000);

  const earnsCredit =
    booking.status === BookingStatus.CONFIRMED &&
    hoursBeforeStart >= CREDIT_WINDOW_HOURS;

  if (earnsCredit) {
    const creditExpiresAt = new Date(now.getTime() + CREDIT_VALIDITY_MS);
    let restore: {
      restoredCents: number;
      freshCreditCents: number;
      restoredMaxExpiry: Date | null;
    };
    try {
      restore = await prisma.$transaction(async (tx) => {
        const flipped = await tx.booking.updateMany({
          where: { id: booking.id, status: { in: CANCELABLE_STATUSES } },
          data: {
            status: BookingStatus.CANCELLED_BY_USER,
            cancelledByUserAt: now,
          },
        });
        if (flipped.count === 0) {
          throw new AlreadyCancelledError();
        }

        // F-060: restore the credits that funded this booking, preserving their
        // ORIGINAL expiry. This is what closes the expiry-refresh loophole —
        // spending a near-expiry credit and cancelling cannot mint a fresh
        // 1-year credit for that value. Cash actually paid is credited fresh.
        const used = await tx.accountCredit.findMany({
          where: { usedOnBookingId: booking.id, status: CreditStatus.USED },
          select: { id: true, amountCents: true, expiresAt: true },
        });
        const restoredCents = used.reduce((sum, c) => sum + c.amountCents, 0);
        if (used.length > 0) {
          await tx.accountCredit.updateMany({
            where: { id: { in: used.map((c) => c.id) }, status: CreditStatus.USED },
            data: {
              status: CreditStatus.ACTIVE,
              usedAt: null,
              usedOnBookingId: null,
            },
          });
        }

        // Fresh 1-year credit only for the cash portion (total minus what the
        // restored credits already cover). A 100%-cash booking restores nothing
        // and mints one credit of the full price — the original F-058 behaviour.
        const freshCreditCents = Math.max(
          0,
          booking.totalPriceCents - restoredCents,
        );
        if (freshCreditCents > 0) {
          await tx.accountCredit.create({
            data: {
              userId: booking.bookerId,
              amountCents: freshCreditCents,
              sourceBookingId: booking.id,
              reason: CreditReason.USER_CANCEL,
              status: CreditStatus.ACTIVE,
              expiresAt: creditExpiresAt,
            },
          });
        }

        const restoredMaxExpiry = used.reduce<Date | null>(
          (max, c) => (max === null || c.expiresAt > max ? c.expiresAt : max),
          null,
        );
        return { restoredCents, freshCreditCents, restoredMaxExpiry };
      });
    } catch (err) {
      if (err instanceof AlreadyCancelledError) {
        return { ok: false, error: "ALREADY_CANCELLED" };
      }
      throw err;
    }

    // Total value returned to the booker: restored credits + the fresh cash
    // credit. The reported expiry is the fresh credit's (1y) when there is one,
    // otherwise the furthest-out restored credit — the cancellation email
    // summarises potentially-multiple expiries to a single date.
    const creditAmountCents = restore.restoredCents + restore.freshCreditCents;
    const reportedExpiresAt =
      restore.freshCreditCents > 0
        ? creditExpiresAt
        : (restore.restoredMaxExpiry ?? creditExpiresAt);

    return {
      ok: true,
      outcome: "credit",
      hoursBeforeStart,
      creditAmountCents,
      creditExpiresAt: reportedExpiresAt,
      duration: booking.duration,
      date: booking.date,
    };
  }

  // Forfeit path (<48h, or a never-paid PENDING_PAYMENT draft). Credits already
  // USED on a paid booking are forfeited per the 48h policy. Credits merely
  // LOCKED by an unpaid draft were never spent, so release them back to ACTIVE.
  const flippedCount = await prisma.$transaction(async (tx) => {
    const flipped = await tx.booking.updateMany({
      where: { id: booking.id, status: { in: CANCELABLE_STATUSES } },
      data: {
        status: BookingStatus.CANCELLED_BY_USER,
        cancelledByUserAt: now,
      },
    });
    if (flipped.count === 0) {
      return 0;
    }
    await tx.accountCredit.updateMany({
      where: { lockedByBookingId: booking.id, status: CreditStatus.LOCKED },
      data: { status: CreditStatus.ACTIVE, lockedByBookingId: null },
    });
    return flipped.count;
  });
  if (flippedCount === 0) {
    return { ok: false, error: "ALREADY_CANCELLED" };
  }
  return {
    ok: true,
    outcome: "forfeit",
    hoursBeforeStart,
    duration: booking.duration,
    date: booking.date,
  };
}

class AlreadyCancelledError extends Error {
  constructor() {
    super("BOOKING_ALREADY_CANCELLED");
    this.name = "AlreadyCancelledError";
  }
}
