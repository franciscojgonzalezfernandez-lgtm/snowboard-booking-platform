import "server-only";

import type { Prisma } from "@prisma/client";

import type { Db } from "@/lib/db";

// Pure, dependency-injected loader for the student dashboard (F-047+),
// mirroring lib/admin/bookings.ts: the page in app/[locale]/dashboard/page.tsx
// is plumbing (session → calls this → renders), while the queries live here
// where Vitest can drive them without next/headers. Row types are derived from
// the selects (Prisma.*GetPayload), so adding a field is a one-place change —
// this replaces the old hand-written types the page cast its queries to.

const BOOKING_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  status: true,
  totalPriceCents: true,
  chargeAmountCents: true,
  creditsAppliedCents: true,
  createdAt: true,
  cancelledByUserAt: true,
  cancelledByOpsAt: true,
  opsReason: true,
  refundedAt: true,
  refundAmountCents: true,
  instructor: { select: { user: { select: { name: true } } } },
} satisfies Prisma.BookingSelect;

const CREDIT_SELECT = {
  id: true,
  amountCents: true,
  sourceBookingId: true,
  expiresAt: true,
  status: true,
} satisfies Prisma.AccountCreditSelect;

const ACTIVE_CREDIT_SELECT = {
  id: true,
  amountCents: true,
  expiresAt: true,
  createdAt: true,
} satisfies Prisma.AccountCreditSelect;

const ACCOUNT_SELECT = {
  name: true,
  email: true,
  phone: true,
} satisfies Prisma.UserSelect;

export type DashboardBookingRow = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SELECT;
}>;

export type DashboardCreditRow = Prisma.AccountCreditGetPayload<{
  select: typeof CREDIT_SELECT;
}>;

export type DashboardActiveCreditRow = Prisma.AccountCreditGetPayload<{
  select: typeof ACTIVE_CREDIT_SELECT;
}>;

export type DashboardAccount = Prisma.UserGetPayload<{
  select: typeof ACCOUNT_SELECT;
}>;

export type DashboardOverview = {
  /** Every booking of the user, newest class first (date desc, time desc). */
  bookings: DashboardBookingRow[];
  /** Full credit ledger, keyed by sourceBookingId at the call site. */
  credits: DashboardCreditRow[];
  /** Spendable credits only (ACTIVE and unexpired), soonest expiry first. */
  activeCredits: DashboardActiveCreditRow[];
  /** Account card data; null only if the session user row vanished. */
  account: DashboardAccount | null;
};

export type DashboardOverviewDeps = {
  prisma: Db;
};

export async function loadDashboardOverview(
  deps: DashboardOverviewDeps,
  { userId, now }: { userId: string; now: Date },
): Promise<DashboardOverview> {
  const { prisma } = deps;
  const [bookings, credits, activeCredits, account] = await Promise.all([
    prisma.booking.findMany({
      where: { bookerId: userId },
      orderBy: [{ date: "desc" }, { anchorTime: "desc" }],
      select: BOOKING_SELECT,
    }),
    prisma.accountCredit.findMany({
      where: { userId },
      select: CREDIT_SELECT,
    }),
    prisma.accountCredit.findMany({
      where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "asc" },
      select: ACTIVE_CREDIT_SELECT,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: ACCOUNT_SELECT,
    }),
  ]);
  return { bookings, credits, activeCredits, account };
}
