import { describe, expect, test, vi } from "vitest";
import {
  BookingStatus,
  CreditReason,
  CreditStatus,
  Duration,
  Level,
  Locale,
} from "@prisma/client";

import {
  loadAdminBookingDetail,
  type AdminBookingDetail,
  type AdminBookingDetailDeps,
} from "./booking-detail";

function buildBooking(): AdminBookingDetail {
  return {
    id: "bk_1",
    date: new Date("2026-12-15T00:00:00.000Z"),
    anchorTime: "10:00",
    duration: Duration.ONE_HOUR,
    language: Locale.en,
    status: BookingStatus.CONFIRMED,
    notes: null,
    totalPriceCents: 11000,
    chargeAmountCents: 11000,
    creditsAppliedCents: null,
    stripePaymentIntentId: "pi_123",
    icsUid: "ics_1@rideflumserberg.ch",
    googleEventId: null,
    paidAt: new Date("2026-12-01T12:00:00.000Z"),
    refundedAt: null,
    refundAmountCents: null,
    failureReason: null,
    cancelledByUserAt: null,
    cancelledByOpsAt: null,
    opsReason: null,
    autoCompletedAt: null,
    confirmationEmailSentAt: new Date("2026-12-01T12:01:00.000Z"),
    reminder24hSentAt: null,
    postClassEmailSentAt: null,
    cancellationEmailSentAt: null,
    opsCancellationNotifSentAt: null,
    createdAt: new Date("2026-12-01T11:59:00.000Z"),
    booker: {
      id: "user_booker",
      name: "Jane",
      email: "jane@example.com",
      phone: "+41 76 000 00 00",
    },
    instructor: {
      id: "inst_1",
      user: { name: "Javi", email: "javi@example.com" },
    },
    attendees: [
      {
        id: "att_booker",
        name: "Jane",
        birthDate: new Date("1990-01-01T00:00:00.000Z"),
        level: Level.INTERMEDIATE,
        isBooker: true,
      },
      {
        id: "att_other",
        name: "Tom",
        birthDate: new Date("1992-02-02T00:00:00.000Z"),
        level: Level.BEGINNER,
        isBooker: false,
      },
    ],
    creditsSourced: [
      {
        id: "cr_1",
        amountCents: 5000,
        reason: CreditReason.USER_CANCEL,
        status: CreditStatus.ACTIVE,
        expiresAt: new Date("2027-12-15T00:00:00.000Z"),
        usedAt: null,
        createdAt: new Date("2026-12-02T00:00:00.000Z"),
      },
    ],
    creditsRedeemed: [],
  };
}

function makeDeps(booking: AdminBookingDetail | null) {
  const findUnique = vi.fn(async () => booking);
  const deps: AdminBookingDetailDeps = {
    prisma: { booking: { findUnique } } as unknown as AdminBookingDetailDeps["prisma"],
  };
  return { deps, spies: { findUnique } };
}

describe("loadAdminBookingDetail", () => {
  test("returns the booking with attendees + credit ledger", async () => {
    const booking = buildBooking();
    const { deps } = makeDeps(booking);
    const result = await loadAdminBookingDetail(deps, { id: "bk_1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.id).toBe("bk_1");
    expect(result.booking.creditsSourced).toHaveLength(1);
    expect(result.booking.attendees).toHaveLength(2);
  });

  test("returns NOT_FOUND when the booking does not exist", async () => {
    const { deps } = makeDeps(null);
    const result = await loadAdminBookingDetail(deps, { id: "missing" });
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  test("orders attendees with the booker first (relies on Prisma orderBy)", async () => {
    const booking = buildBooking();
    const { deps } = makeDeps(booking);
    const result = await loadAdminBookingDetail(deps, { id: "bk_1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.attendees[0]!.isBooker).toBe(true);
  });
});
