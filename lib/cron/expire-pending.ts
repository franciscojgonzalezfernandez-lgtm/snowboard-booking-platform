// Pending-payment expiry sweep. Lives in its own cron (schedule `*/15 * * * *`)
// because the email cron — booking reminders + post-class follow-ups — only
// fires once a day. If we folded the pending sweep into that handler the DB
// would drift by up to 24h between abandonments and the row flipping to
// PAYMENT_FAILED, which breaks admin queries / analytics / webhook
// reconciliation. The dashboard already hides stale rows via a query filter,
// but DB state must catch up regardless.
//
// Source of truth for the 15-minute cutoff: `IDEMPOTENCY_WINDOW_MS` in
// lib/booking/create-draft.ts. Mirrored here as `PENDING_PAYMENT_EXPIRY_MS`.

import type { Db } from "@/lib/db";

export const PENDING_PAYMENT_EXPIRY_MS = 15 * 60 * 1000;

export type ExpirePendingDeps = {
  prisma: Db;
  now: Date;
};

export type ExpirePendingSummary = {
  now: string;
  flipped: number;
  /** F-060: credits unlocked back to ACTIVE because their draft expired. */
  creditsReleased: number;
};

export async function runExpirePendingCron(
  deps: ExpirePendingDeps,
): Promise<ExpirePendingSummary> {
  const cutoff = new Date(deps.now.getTime() - PENDING_PAYMENT_EXPIRY_MS);
  // Snapshot the stale ids first so we can release the credits they locked.
  // A bulk updateMany can't return affected ids, and updateMany `where` can't
  // filter AccountCredit by the related booking's status.
  const stale = await deps.prisma.booking.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (stale.length === 0) {
    return { now: deps.now.toISOString(), flipped: 0, creditsReleased: 0 };
  }
  const ids = stale.map((b) => b.id);

  // Re-assert the status + cutoff guard so a booking that confirmed between the
  // snapshot and now is not clobbered back to PAYMENT_FAILED.
  const result = await deps.prisma.booking.updateMany({
    where: { id: { in: ids }, status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    // `notes` flags expiry as the cause so admin queries can tell apart rows
    // that timed out from rows flipped by a real Stripe `payment_failed` event
    // (those carry a `failureReason` populated from `last_payment_error`).
    data: { status: "PAYMENT_FAILED", notes: "expired time" },
  });

  // F-060: return credits that were locked by these expired drafts. The
  // `status: LOCKED` guard means a credit already settled to USED (the booking
  // actually confirmed in the race window) is left untouched.
  const released = await deps.prisma.accountCredit.updateMany({
    where: { lockedByBookingId: { in: ids }, status: "LOCKED" },
    data: { status: "ACTIVE", lockedByBookingId: null },
  });

  return {
    now: deps.now.toISOString(),
    flipped: result.count,
    creditsReleased: released.count,
  };
}
