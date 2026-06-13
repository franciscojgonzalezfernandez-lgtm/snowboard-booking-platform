import "server-only";

import type {
  BookingStatus,
  CreditReason,
  CreditStatus,
  Duration,
  Level,
  Locale,
} from "@prisma/client";

import type { Db } from "@/lib/db";

// Pure loader for a single admin booking detail (F-077). Includes the full
// row + attendees (booker-first) + the AccountCredit ledger entries that
// reference this booking on either side (sourced + redeemed).

export type AdminBookingAttendee = {
  id: string;
  name: string;
  birthDate: Date;
  level: Level;
  isBooker: boolean;
};

export type AdminBookingCreditLedgerEntry = {
  id: string;
  amountCents: number;
  reason: CreditReason;
  status: CreditStatus;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type AdminBookingDetail = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  status: BookingStatus;
  notes: string | null;
  totalPriceCents: number;
  chargeAmountCents: number | null;
  creditsAppliedCents: number | null;
  stripePaymentIntentId: string | null;
  icsUid: string;
  googleEventId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundAmountCents: number | null;
  failureReason: string | null;
  cancelledByUserAt: Date | null;
  cancelledByOpsAt: Date | null;
  opsReason: string | null;
  autoCompletedAt: Date | null;
  confirmationEmailSentAt: Date | null;
  reminder24hSentAt: Date | null;
  postClassEmailSentAt: Date | null;
  cancellationEmailSentAt: Date | null;
  opsCancellationNotifSentAt: Date | null;
  createdAt: Date;
  booker: { id: string; name: string | null; email: string; phone: string | null };
  instructor: { id: string; user: { name: string | null; email: string } };
  attendees: AdminBookingAttendee[];
  creditsSourced: AdminBookingCreditLedgerEntry[];
  creditsRedeemed: AdminBookingCreditLedgerEntry[];
};

export type AdminBookingDetailResult =
  | { ok: true; booking: AdminBookingDetail }
  | { ok: false; error: "NOT_FOUND" };

export type AdminBookingDetailDeps = {
  prisma: Db;
};

const DETAIL_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  status: true,
  notes: true,
  totalPriceCents: true,
  chargeAmountCents: true,
  creditsAppliedCents: true,
  stripePaymentIntentId: true,
  icsUid: true,
  googleEventId: true,
  paidAt: true,
  refundedAt: true,
  refundAmountCents: true,
  failureReason: true,
  cancelledByUserAt: true,
  cancelledByOpsAt: true,
  opsReason: true,
  autoCompletedAt: true,
  confirmationEmailSentAt: true,
  reminder24hSentAt: true,
  postClassEmailSentAt: true,
  cancellationEmailSentAt: true,
  opsCancellationNotifSentAt: true,
  createdAt: true,
  booker: { select: { id: true, name: true, email: true, phone: true } },
  instructor: { select: { id: true, user: { select: { name: true, email: true } } } },
  attendees: {
    select: { id: true, name: true, birthDate: true, level: true, isBooker: true },
    orderBy: { isBooker: "desc" },
  },
  creditsSourced: {
    select: {
      id: true,
      amountCents: true,
      reason: true,
      status: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  },
  creditsRedeemed: {
    select: {
      id: true,
      amountCents: true,
      reason: true,
      status: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  },
} as const;

export async function loadAdminBookingDetail(
  deps: AdminBookingDetailDeps,
  args: { id: string },
): Promise<AdminBookingDetailResult> {
  const booking = await deps.prisma.booking.findUnique({
    where: { id: args.id },
    select: DETAIL_SELECT,
  });
  if (!booking) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, booking };
}
