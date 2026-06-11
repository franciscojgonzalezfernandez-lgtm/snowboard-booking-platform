// Account-credit expiry sweep. Credits issued on a ≥48h user cancellation
// (F-058) carry `expiresAt = now + 365d` and stay `ACTIVE` until consumed. The
// dashboard aside (F-059) already filters by `expiresAt > now`, so an expired
// credit is never offered at checkout — but the row keeps `status = ACTIVE`,
// which is misleading for admin tooling and future analytics. This sweep flips
// lapsed credits to `EXPIRED` so the stored status matches reality.
//
// Runs daily as its own cron (`0 1 * * *`, 01:00 UTC). Daily (not monthly)
// keeps the status lag under 24h and means a single missed run can never strand
// a credit as ACTIVE for ~a month. The sweep is idempotent, so the extra runs
// cost nothing.

import type { Db } from "@/lib/db";

export type ExpireCreditsDeps = {
  prisma: Db;
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
