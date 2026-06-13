import { describe, expect, test, vi } from "vitest";
import { BookingStatus, CreditReason, CreditStatus } from "@prisma/client";

import {
  OPS_CREDIT_VALIDITY_MS,
  cancelBookingByOpsWith,
  type CancelBookingByOpsDeps,
} from "./cancel-by-ops";
import {
  FIXED_NOW,
  makeBookingFixture,
  type BookingFixture,
} from "./fixtures";

const NOW = FIXED_NOW;
const CLASS_START = new Date("2026-12-11T08:00:00.000Z");
const BOOKER_ID = "user_booker";
const ADMIN_ID = "user_admin";

// Suite defaults on top of the shared fixture: a fully-paid 2h lesson, so the
// refund paths have real money to work with.
function makeBooking(overrides: Partial<BookingFixture> = {}): BookingFixture {
  return makeBookingFixture({
    bookerId: BOOKER_ID,
    totalPriceCents: 20000,
    chargeAmountCents: 20000,
    creditsAppliedCents: 0,
    stripePaymentIntentId: "pi_test_1",
    paidAt: new Date("2026-11-20T10:00:00.000Z"),
    ...overrides,
  });
}

type Captured = {
  stripeCalls: Array<{
    paymentIntentId: string;
    amountCents: number;
    idempotencyKey: string;
  }>;
  bookingUpdateMany: Array<{
    where: { id: string; status: { in: readonly BookingStatus[] } };
    data: {
      status: BookingStatus;
      cancelledByOpsAt: Date;
      opsReason: string | null;
    };
  }>;
  bookingUpdate: Array<{
    where: { id: string };
    data: { stripeRefundId: string; refundedAt: Date; refundAmountCents: number };
  }>;
  creditCreates: Array<{
    userId: string;
    amountCents: number;
    sourceBookingId: string;
    reason: CreditReason;
    status: CreditStatus;
    expiresAt: Date;
  }>;
  creditUpdates: Array<{
    where: { lockedByBookingId: string; status: CreditStatus };
    data: { status: CreditStatus; lockedByBookingId: null };
  }>;
};

function makeDeps(opts: {
  booking: BookingFixture | null;
  refundId?: string;
  refundShouldThrow?: boolean;
}): { deps: CancelBookingByOpsDeps; captured: Captured } {
  const fixture = opts.booking;
  const refundId = opts.refundId ?? "re_test_1";

  const captured: Captured = {
    stripeCalls: [],
    bookingUpdateMany: [],
    bookingUpdate: [],
    creditCreates: [],
    creditUpdates: [],
  };

  let liveStatus = fixture?.status ?? BookingStatus.CANCELLED_BY_OPS;

  const updateMany = vi.fn(async (args: Captured["bookingUpdateMany"][number]) => {
    captured.bookingUpdateMany.push(args);
    if (!fixture || args.where.id !== fixture.id) return { count: 0 };
    if (!args.where.status.in.includes(liveStatus)) return { count: 0 };
    liveStatus = args.data.status;
    return { count: 1 };
  });

  const creditCreate = vi.fn(
    async (args: { data: Captured["creditCreates"][number] }) => {
      captured.creditCreates.push(args.data);
      return { id: "credit_new" };
    },
  );

  const creditUpdateMany = vi.fn(
    async (args: Captured["creditUpdates"][number]) => {
      captured.creditUpdates.push(args);
      return { count: 0 };
    },
  );

  const bookingUpdate = vi.fn(async (args: Captured["bookingUpdate"][number]) => {
    captured.bookingUpdate.push(args);
    return { id: args.where.id };
  });

  const prisma = {
    booking: {
      findUnique: vi.fn(async () => fixture),
      update: bookingUpdate,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        booking: { updateMany },
        accountCredit: {
          create: creditCreate,
          updateMany: creditUpdateMany,
        },
      }),
    ),
  };

  const stripeRefund = vi.fn(async (args: Captured["stripeCalls"][number]) => {
    captured.stripeCalls.push(args);
    if (opts.refundShouldThrow) throw new Error("stripe fail");
    return { id: refundId };
  });

  return {
    deps: {
      adminUserId: ADMIN_ID,
      prisma: prisma as unknown as CancelBookingByOpsDeps["prisma"],
      stripeRefund,
      now: NOW,
    },
    captured,
  };
}

describe("cancelBookingByOpsWith", () => {
  test("cash refund happy: refunds Stripe, flips status, persists refund id", async () => {
    const { deps, captured } = makeDeps({
      booking: makeBooking({
        chargeAmountCents: 20000,
        creditsAppliedCents: 0,
      }),
    });

    const result = await cancelBookingByOpsWith(deps, {
      bookingId: "book_1",
      reason: "weather",
    });

    expect(result).toMatchObject({
      ok: true,
      outcome: "cash",
      cashRefundedCents: 20000,
      stripeRefundId: "re_test_1",
      creditReEmittedCents: 0,
      creditExpiresAt: null,
    });
    expect(captured.stripeCalls).toHaveLength(1);
    expect(captured.stripeCalls[0]).toMatchObject({
      paymentIntentId: "pi_test_1",
      amountCents: 20000,
      idempotencyKey: "ops-refund-book_1",
    });
    expect(captured.bookingUpdateMany[0]!.data.status).toBe(
      BookingStatus.CANCELLED_BY_OPS,
    );
    expect(captured.bookingUpdateMany[0]!.data.opsReason).toBe("weather");
    expect(captured.bookingUpdate).toHaveLength(1);
    expect(captured.bookingUpdate[0]!.data.stripeRefundId).toBe("re_test_1");
    expect(captured.bookingUpdate[0]!.data.refundAmountCents).toBe(20000);
    expect(captured.creditCreates).toHaveLength(0);
  });

  test("credit re-emit happy: no Stripe call, mints OPS_CANCEL credit anchored on lesson start", async () => {
    const { deps, captured } = makeDeps({
      booking: makeBooking({
        chargeAmountCents: 0,
        creditsAppliedCents: 20000,
        stripePaymentIntentId: null,
        paidAt: null,
      }),
    });

    const result = await cancelBookingByOpsWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({
      ok: true,
      outcome: "credit",
      cashRefundedCents: 0,
      stripeRefundId: null,
      creditReEmittedCents: 20000,
    });
    expect(captured.stripeCalls).toHaveLength(0);
    expect(captured.bookingUpdate).toHaveLength(0);
    expect(captured.creditCreates).toHaveLength(1);
    expect(captured.creditCreates[0]).toMatchObject({
      userId: BOOKER_ID,
      amountCents: 20000,
      sourceBookingId: "book_1",
      reason: CreditReason.OPS_CANCEL,
      status: CreditStatus.ACTIVE,
    });
    expect(captured.creditCreates[0]!.expiresAt.getTime()).toBe(
      CLASS_START.getTime() + OPS_CREDIT_VALIDITY_MS,
    );
  });

  test("mixed: Stripe refunds the cash portion + mints credit for the credit portion", async () => {
    const { deps, captured } = makeDeps({
      booking: makeBooking({
        totalPriceCents: 20000,
        chargeAmountCents: 9000,
        creditsAppliedCents: 11000,
      }),
    });

    const result = await cancelBookingByOpsWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({
      ok: true,
      outcome: "mixed",
      cashRefundedCents: 9000,
      creditReEmittedCents: 11000,
    });
    expect(captured.stripeCalls).toHaveLength(1);
    expect(captured.stripeCalls[0]!.amountCents).toBe(9000);
    expect(captured.creditCreates).toHaveLength(1);
    expect(captured.creditCreates[0]!.amountCents).toBe(11000);
    expect(captured.bookingUpdate[0]!.data.refundAmountCents).toBe(9000);
  });

  test("idempotency: re-cancel returns already_cancelled, no Stripe call, no DB writes", async () => {
    const { deps, captured } = makeDeps({
      booking: makeBooking({
        status: BookingStatus.CANCELLED_BY_OPS,
        stripeRefundId: "re_existing",
      }),
    });

    const result = await cancelBookingByOpsWith(deps, { bookingId: "book_1" });

    expect(result).toEqual({
      ok: true,
      outcome: "already_cancelled",
      bookerId: BOOKER_ID,
    });
    expect(captured.stripeCalls).toHaveLength(0);
    expect(captured.bookingUpdateMany).toHaveLength(0);
    expect(captured.bookingUpdate).toHaveLength(0);
    expect(captured.creditCreates).toHaveLength(0);
  });

  test("rejects a booking already cancelled by the user with FORBIDDEN_STATUS", async () => {
    const { deps, captured } = makeDeps({
      booking: makeBooking({ status: BookingStatus.CANCELLED_BY_USER }),
    });

    const result = await cancelBookingByOpsWith(deps, { bookingId: "book_1" });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN_STATUS" });
    expect(captured.stripeCalls).toHaveLength(0);
    expect(captured.bookingUpdateMany).toHaveLength(0);
  });

  test("returns NOT_FOUND when the booking id does not exist", async () => {
    const { deps, captured } = makeDeps({ booking: null });

    const result = await cancelBookingByOpsWith(deps, { bookingId: "ghost" });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(captured.stripeCalls).toHaveLength(0);
  });

  test("PENDING_PAYMENT: no Stripe, no credit mint, LOCKED credits released to ACTIVE", async () => {
    const { deps, captured } = makeDeps({
      booking: makeBooking({
        status: BookingStatus.PENDING_PAYMENT,
        chargeAmountCents: 9000,
        creditsAppliedCents: 11000,
        paidAt: null,
      }),
    });

    const result = await cancelBookingByOpsWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({
      ok: true,
      outcome: "no_charge",
      cashRefundedCents: 0,
      creditReEmittedCents: 0,
      creditExpiresAt: null,
    });
    expect(captured.stripeCalls).toHaveLength(0);
    expect(captured.creditCreates).toHaveLength(0);
    expect(captured.creditUpdates).toHaveLength(1);
    expect(captured.creditUpdates[0]!.where.lockedByBookingId).toBe("book_1");
    expect(captured.creditUpdates[0]!.data.status).toBe(CreditStatus.ACTIVE);
  });
});
