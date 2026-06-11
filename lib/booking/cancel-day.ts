import { BookingStatus, Prisma, type Duration, type Locale } from "@prisma/client";

import { addDays, startOfUtcDay } from "@/lib/booking-engine/time";
import type { Db } from "@/lib/db";

// Pure ops-cancel-day logic (F-079). The thin Server Action wrapper in
// `app/admin/actions.ts` resolves the admin session via `requireAdmin()` and
// dispatches per-booking emails (each underlying `cancelBookingByOpsWith`
// call already handles its own Stripe refund + DB flip).
//
// Why no $transaction wrapping the batch:
//   Stripe refunds are external side-effects per PaymentIntent. Wrapping N
//   bookings in a single DB transaction would either (a) require collecting
//   all refunds first and only flipping statuses after — losing atomicity
//   between Stripe and DB, or (b) hold the transaction open while waiting on
//   Stripe API calls. Per F-079 AC: partial failures are tolerated — the
//   owner re-runs the batch (each booking is idempotent via F-078's
//   `Idempotency-Key: ops-refund-${bookingId}` + status guard).

export const CANCELLABLE_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.COMPLETED,
] as const;

/** Columns the preview reads per booking. Single source of truth — the row
 * type below is derived from it, so adding a field here updates both. */
const ROW_SELECT = {
  id: true,
  anchorTime: true,
  duration: true,
  language: true,
  status: true,
  totalPriceCents: true,
  chargeAmountCents: true,
  creditsAppliedCents: true,
  stripePaymentIntentId: true,
  paidAt: true,
  booker: { select: { name: true, email: true } },
  instructor: { select: { id: true, user: { select: { name: true } } } },
  attendees: { select: { id: true } },
} satisfies Prisma.BookingSelect;

export type CancelDayBookingRow = Prisma.BookingGetPayload<{
  select: typeof ROW_SELECT;
}>;

export type CancelDayPreviewBooking = {
  id: string;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  status: BookingStatus;
  bookerName: string | null;
  bookerEmail: string;
  instructorName: string | null;
  instructorId: string;
  totalPriceCents: number;
  /** Cash captured (= what Stripe will refund). Mirrors F-078 `hasCashCapture`
   * gating: only money actually charged, never for PENDING_PAYMENT. */
  cashRefundCents: number;
  /** Credit that will be re-emitted fresh (`creditsAppliedCents`). Zero for
   * PENDING_PAYMENT — there was no captured payment to convert. */
  creditReEmitCents: number;
  attendeesCount: number;
};

export type CancelDayPreview = {
  date: string;
  instructorId: string | null;
  bookings: CancelDayPreviewBooking[];
  totals: {
    bookingsCount: number;
    attendeesCount: number;
    cashRefundCents: number;
    creditReEmitCents: number;
  };
};

export type CancelDayPreviewInput = {
  /** UTC date in `YYYY-MM-DD`. */
  date: string;
  /** Optional filter — when omitted, every active-instructor booking that day
   * is in scope. */
  instructorId?: string;
};

export type CancelDayDeps = {
  prisma: Db;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayRange(date: string): { gte: Date; lt: Date } {
  const dayStart = startOfUtcDay(new Date(`${date}T00:00:00.000Z`));
  return { gte: dayStart, lt: addDays(dayStart, 1) };
}

function projectedCashRefundCents(row: CancelDayBookingRow): number {
  // Mirror F-078 `hasCashCapture`: PENDING_PAYMENT was never captured (no
  // money to refund); CONFIRMED/COMPLETED need `paidAt` + a Stripe PI.
  if (row.status === BookingStatus.PENDING_PAYMENT) return 0;
  if (row.paidAt === null || row.stripePaymentIntentId === null) return 0;
  return row.chargeAmountCents ?? row.totalPriceCents;
}

function projectedCreditReEmitCents(row: CancelDayBookingRow): number {
  if (row.status === BookingStatus.PENDING_PAYMENT) return 0;
  return row.creditsAppliedCents ?? 0;
}

function toPreviewBooking(row: CancelDayBookingRow): CancelDayPreviewBooking {
  return {
    id: row.id,
    anchorTime: row.anchorTime,
    duration: row.duration,
    language: row.language,
    status: row.status,
    bookerName: row.booker.name,
    bookerEmail: row.booker.email,
    instructorName: row.instructor.user.name,
    instructorId: row.instructor.id,
    totalPriceCents: row.totalPriceCents,
    cashRefundCents: projectedCashRefundCents(row),
    creditReEmitCents: projectedCreditReEmitCents(row),
    attendeesCount: row.attendees.length,
  };
}

export type PreviewCancelDayResult =
  | { ok: true; preview: CancelDayPreview }
  | { ok: false; error: "INVALID_INPUT" };

/**
 * Aggregates the impact of an ops-cancel-day batch before the owner confirms.
 * Read-only: no Stripe call, no DB write. The owner sees per-booking lines +
 * totals and decides whether to proceed.
 */
export async function previewCancelDayWith(
  deps: CancelDayDeps,
  input: CancelDayPreviewInput,
): Promise<PreviewCancelDayResult> {
  if (!DATE_RE.test(input.date)) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const where: Prisma.BookingWhereInput = {
    date: dayRange(input.date),
    status: { in: [...CANCELLABLE_STATUSES] },
  };
  if (input.instructorId) where.instructorId = input.instructorId;

  const rows = await deps.prisma.booking.findMany({
    where,
    orderBy: [{ anchorTime: "asc" }],
    select: ROW_SELECT,
  });

  const bookings = rows.map(toPreviewBooking);
  const totals = bookings.reduce(
    (acc, b) => {
      acc.bookingsCount += 1;
      acc.attendeesCount += b.attendeesCount;
      acc.cashRefundCents += b.cashRefundCents;
      acc.creditReEmitCents += b.creditReEmitCents;
      return acc;
    },
    {
      bookingsCount: 0,
      attendeesCount: 0,
      cashRefundCents: 0,
      creditReEmitCents: 0,
    },
  );

  return {
    ok: true,
    preview: {
      date: input.date,
      instructorId: input.instructorId ?? null,
      bookings,
      totals,
    },
  };
}

export type CancelDayBookingResult =
  | {
      bookingId: string;
      ok: true;
      outcome:
        | "cash"
        | "credit"
        | "mixed"
        | "no_charge"
        | "already_cancelled";
      cashRefundedCents: number;
      creditReEmittedCents: number;
    }
  | {
      bookingId: string;
      ok: false;
      error: "NOT_FOUND" | "FORBIDDEN_STATUS" | "UNCAUGHT";
      message?: string;
    };

export type CancelDayBatchResult =
  | {
      ok: true;
      date: string;
      instructorId: string | null;
      results: CancelDayBookingResult[];
      totals: {
        attempted: number;
        succeeded: number;
        failed: number;
        alreadyCancelled: number;
        cashRefundedCents: number;
        creditReEmittedCents: number;
      };
    }
  | { ok: false; error: "INVALID_INPUT" };

export type CancelDayBatchInput = {
  date: string;
  instructorId?: string;
  reason?: string;
};

/**
 * Result of the per-booking cancel-by-ops action. Mirrors the public
 * `CancelBookingByOpsActionResult` so the action wrapper can pass its own
 * function through without restructuring fields.
 */
export type CancelOneOutcome =
  | {
      ok: true;
      outcome: "cash" | "credit" | "mixed" | "no_charge" | "already_cancelled";
      cashRefundedCents: number;
      creditReEmittedCents: number;
    }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN_STATUS" };

export type CancelOneFn = (input: {
  bookingId: string;
  reason?: string;
}) => Promise<CancelOneOutcome>;

/**
 * Loops `cancelOne` over every booking matching the day (+ optional instructor
 * filter). Partial failures are caught per booking — the rest of the batch
 * continues. The caller (Server Action) is responsible for revalidation; this
 * core only sequences the per-booking calls and collects outcomes.
 *
 * Sequential (not parallel) on purpose: Stripe rate limits + the per-booking
 * idempotency key means concurrent retries for the same booking are safe,
 * but a single owner click against a day of ~10 bookings doesn't need the
 * complexity of bounded concurrency — sequential is predictable and lets
 * the activity log read top-to-bottom.
 */
export async function cancelDayByOpsWith(
  deps: CancelDayDeps,
  input: CancelDayBatchInput,
  cancelOne: CancelOneFn,
): Promise<CancelDayBatchResult> {
  if (!DATE_RE.test(input.date)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const preview = await previewCancelDayWith(deps, {
    date: input.date,
    instructorId: input.instructorId,
  });
  if (!preview.ok) return preview;

  const results: CancelDayBookingResult[] = [];
  for (const booking of preview.preview.bookings) {
    try {
      const r = await cancelOne({
        bookingId: booking.id,
        reason: input.reason,
      });
      if (r.ok) {
        results.push({
          bookingId: booking.id,
          ok: true,
          outcome: r.outcome,
          cashRefundedCents: r.cashRefundedCents,
          creditReEmittedCents: r.creditReEmittedCents,
        });
      } else {
        results.push({ bookingId: booking.id, ok: false, error: r.error });
      }
    } catch (err) {
      // Defensive: a thrown error (Stripe outage, DB connection drop) for one
      // booking must not abort the rest. The Server Action records to Sentry;
      // here we only need to keep the loop alive.
      results.push({
        bookingId: booking.id,
        ok: false,
        error: "UNCAUGHT",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.attempted += 1;
      if (r.ok) {
        if (r.outcome === "already_cancelled") acc.alreadyCancelled += 1;
        else acc.succeeded += 1;
        acc.cashRefundedCents += r.cashRefundedCents;
        acc.creditReEmittedCents += r.creditReEmittedCents;
      } else {
        acc.failed += 1;
      }
      return acc;
    },
    {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      alreadyCancelled: 0,
      cashRefundedCents: 0,
      creditReEmittedCents: 0,
    },
  );

  return {
    ok: true,
    date: input.date,
    instructorId: input.instructorId ?? null,
    results,
    totals,
  };
}
