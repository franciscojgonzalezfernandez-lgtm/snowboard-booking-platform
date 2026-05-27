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

export const PENDING_PAYMENT_EXPIRY_MS = 15 * 60 * 1000;

export type ExpirePendingDeps = {
  prisma: {
    booking: {
      updateMany(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }): Promise<{ count: number }>;
    };
  };
  now: Date;
};

export type ExpirePendingSummary = {
  now: string;
  flipped: number;
};

export async function runExpirePendingCron(
  deps: ExpirePendingDeps,
): Promise<ExpirePendingSummary> {
  const cutoff = new Date(deps.now.getTime() - PENDING_PAYMENT_EXPIRY_MS);
  const result = await deps.prisma.booking.updateMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: cutoff },
    },
    data: { status: "PAYMENT_FAILED" },
  });
  return {
    now: deps.now.toISOString(),
    flipped: result.count,
  };
}
