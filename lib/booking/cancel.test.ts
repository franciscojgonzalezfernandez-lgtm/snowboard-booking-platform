import { describe, expect, test, vi } from "vitest";
import { BookingStatus, CreditReason, CreditStatus, Duration } from "@prisma/client";

import {
  CREDIT_VALIDITY_MS,
  cancelBookingByUserWith,
  type CancelBookingByUserDeps,
} from "./cancel";

const NOW = new Date("2026-12-01T08:00:00.000Z");
const OWNER_ID = "user_owner";

type BookingFixture = {
  id: string;
  bookerId: string;
  status: BookingStatus;
  date: Date;
  anchorTime: string;
  duration: Duration;
  totalPriceCents: number;
};

function makeBooking(overrides: Partial<BookingFixture> = {}): BookingFixture {
  return {
    id: "book_1",
    bookerId: OWNER_ID,
    status: BookingStatus.CONFIRMED,
    // 2026-12-11 08:00Z is 10 days out from NOW → comfortably ≥48h.
    date: new Date("2026-12-11T00:00:00.000Z"),
    anchorTime: "08:00",
    duration: Duration.ONE_HOUR,
    totalPriceCents: 11000,
    ...overrides,
  };
}

function makeDeps(opts: {
  booking: BookingFixture | null;
  session?: { user: { id: string } } | null;
  now?: Date;
}): {
  deps: CancelBookingByUserDeps;
  bookingUpdates: Array<{
    where: { id: string; status: { in: readonly BookingStatus[] } };
    data: { status: BookingStatus; cancelledByUserAt: Date };
  }>;
  creditCreates: Array<{
    userId: string;
    amountCents: number;
    sourceBookingId: string;
    reason: CreditReason;
    status: CreditStatus;
    expiresAt: Date;
  }>;
} {
  const fixture = opts.booking;
  const bookingUpdates: Array<{
    where: { id: string; status: { in: readonly BookingStatus[] } };
    data: { status: BookingStatus; cancelledByUserAt: Date };
  }> = [];
  const creditCreates: Array<{
    userId: string;
    amountCents: number;
    sourceBookingId: string;
    reason: CreditReason;
    status: CreditStatus;
    expiresAt: Date;
  }> = [];

  // Mutable status so a "second cancel" within one test sees the flip and
  // matches 0 rows on the status-gated updateMany.
  let liveStatus = fixture?.status ?? BookingStatus.CANCELLED_BY_USER;

  const updateMany = vi.fn(
    async (args: {
      where: { id: string; status: { in: readonly BookingStatus[] } };
      data: { status: BookingStatus; cancelledByUserAt: Date };
    }) => {
      bookingUpdates.push(args);
      if (!fixture || args.where.id !== fixture.id) return { count: 0 };
      if (!args.where.status.in.includes(liveStatus)) return { count: 0 };
      liveStatus = args.data.status;
      return { count: 1 };
    },
  );

  const create = vi.fn(
    async (args: { data: (typeof creditCreates)[number] }) => {
      creditCreates.push(args.data);
      return { id: "credit_1" };
    },
  );

  const prisma = {
    booking: {
      findUnique: vi.fn(async () => fixture),
      updateMany,
    },
    $transaction: vi.fn(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ booking: { updateMany }, accountCredit: { create } }),
    ),
  };

  return {
    deps: {
      session:
        opts.session === undefined ? { user: { id: OWNER_ID } } : opts.session,
      prisma: prisma as unknown as CancelBookingByUserDeps["prisma"],
      now: opts.now ?? NOW,
    },
    bookingUpdates,
    creditCreates,
  };
}

describe("cancelBookingByUserWith", () => {
  test("≥48h on a CONFIRMED booking issues a credit equal to the lesson price, valid one year", async () => {
    const { deps, bookingUpdates, creditCreates } = makeDeps({
      booking: makeBooking({ totalPriceCents: 11000 }),
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({
      ok: true,
      outcome: "credit",
      creditAmountCents: 11000,
    });
    expect(creditCreates).toHaveLength(1);
    expect(creditCreates[0]).toMatchObject({
      userId: OWNER_ID,
      amountCents: 11000,
      sourceBookingId: "book_1",
      reason: CreditReason.USER_CANCEL,
      status: CreditStatus.ACTIVE,
    });
    // expiresAt is exactly now + 365 days.
    expect(creditCreates[0]!.expiresAt.getTime()).toBe(
      NOW.getTime() + CREDIT_VALIDITY_MS,
    );
    expect(bookingUpdates[0]!.data.status).toBe(BookingStatus.CANCELLED_BY_USER);
    expect(bookingUpdates[0]!.data.cancelledByUserAt).toEqual(NOW);
  });

  test("<48h on a CONFIRMED booking forfeits with no credit", async () => {
    const { deps, creditCreates } = makeDeps({
      // Starts 2026-12-03 07:00Z = NOW + 47h → inside the window.
      booking: makeBooking({
        date: new Date("2026-12-03T00:00:00.000Z"),
        anchorTime: "07:00",
      }),
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({ ok: true, outcome: "forfeit" });
    expect(creditCreates).toHaveLength(0);
  });

  test("boundary: exactly 48.0h before start falls in the credit path (>=)", async () => {
    const { deps } = makeDeps({
      // Start = NOW + exactly 48h.
      booking: makeBooking({
        date: new Date("2026-12-03T00:00:00.000Z"),
        anchorTime: "08:00",
      }),
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.outcome).toBe("credit");
    expect(result.ok && result.outcome === "credit" && result.hoursBeforeStart).toBe(48);
  });

  test("boundary: 47.999h before start falls in the forfeit path", async () => {
    const { deps } = makeDeps({
      // Start fixed at NOW + 48h, but clock is 36s past NOW → 47.99h remain.
      booking: makeBooking({
        date: new Date("2026-12-03T00:00:00.000Z"),
        anchorTime: "08:00",
      }),
      now: new Date("2026-12-01T08:00:36.000Z"),
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.outcome).toBe("forfeit");
  });

  test("rejects a booking owned by another user with FORBIDDEN", async () => {
    const { deps, bookingUpdates } = makeDeps({
      booking: makeBooking({ bookerId: "user_someone_else" }),
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(bookingUpdates).toHaveLength(0);
  });

  test("rejects an already-cancelled booking with ALREADY_CANCELLED", async () => {
    const { deps, bookingUpdates } = makeDeps({
      booking: makeBooking({ status: BookingStatus.CANCELLED_BY_USER }),
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toEqual({ ok: false, error: "ALREADY_CANCELLED" });
    expect(bookingUpdates).toHaveLength(0);
  });

  test("never credits a PENDING_PAYMENT (never-paid) booking even ≥48h out", async () => {
    const { deps, creditCreates } = makeDeps({
      booking: makeBooking({ status: BookingStatus.PENDING_PAYMENT }),
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({ ok: true, outcome: "forfeit" });
    expect(creditCreates).toHaveLength(0);
  });
});
