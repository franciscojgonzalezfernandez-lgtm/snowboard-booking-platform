import type { Db } from "@/lib/db";

// Spendable account-credit balance for one user (F-087).
//
// "Active" = stored `status = ACTIVE` AND not yet lapsed (`expiresAt > now`).
// Both clauses matter: the expiry sweep (`lib/credit/expire.ts`) only runs
// daily, so a credit can sit `ACTIVE` for up to ~24h after it has actually
// lapsed. Gating on `expiresAt` here means the balance always matches what the
// booker can really redeem at checkout — the exact predicate the dashboard
// aside already uses (`lib/dashboard/overview.ts` → `activeCredits`). Extracted
// so the admin student directory and the dashboard share one definition of
// "active credit" instead of duplicating it.
//
// Summed DB-side via `aggregate` (not by loading rows) so it stays O(1) work
// regardless of how many credits a user has accumulated.

export type CreditBalanceDeps = {
  prisma: Pick<Db, "accountCredit">;
};

export async function getActiveCreditCents(
  deps: CreditBalanceDeps,
  { userId, now }: { userId: string; now: Date },
): Promise<number> {
  const result = await deps.prisma.accountCredit.aggregate({
    where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}
