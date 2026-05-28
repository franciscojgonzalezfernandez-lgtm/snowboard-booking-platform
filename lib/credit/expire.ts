// Account-credit expiry sweep. Credits issued on a ≥48h user cancellation
// (F-058) carry `expiresAt = now + 365d` and stay `ACTIVE` until consumed. The
// dashboard aside (F-059) already filters by `expiresAt > now`, so an expired
// credit is never offered at checkout — but the row keeps `status = ACTIVE`,
// which is misleading for admin tooling and future analytics. This monthly
// sweep flips lapsed credits to `EXPIRED` so the stored status matches reality.
//
// Runs as its own cron (`0 0 1 * *`, first of the month at 00:00 UTC) now that
// the project is on Vercel Pro — the Hobby 2-cron cap that would have forced
// folding this into an existing handler no longer applies.

export type ExpireCreditsDeps = {
  prisma: {
    accountCredit: {
      updateMany(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }): Promise<{ count: number }>;
    };
  };
  now: Date;
};

export type ExpireCreditsSummary = {
  now: string;
  expired: number;
};

export async function runExpireCreditsCron(
  deps: ExpireCreditsDeps,
): Promise<ExpireCreditsSummary> {
  // Status guard makes this idempotent: a second run re-matches 0 rows because
  // the first already moved them out of ACTIVE.
  const result = await deps.prisma.accountCredit.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: deps.now },
    },
    data: { status: "EXPIRED" },
  });
  return {
    now: deps.now.toISOString(),
    expired: result.count,
  };
}
