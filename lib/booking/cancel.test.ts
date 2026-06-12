import { describe, expect, test, vi } from "vitest";
import { BookingStatus, CreditReason, CreditStatus } from "@prisma/client";

import {
  CREDIT_VALIDITY_MS,
  cancelBookingByUserWith,
  type CancelBookingByUserDeps,
} from "./cancel";
import {
  FIXED_NOW,
  makeBookingFixture as makeBooking,
  type BookingFixture,
} from "./fixtures";

const NOW = FIXED_NOW;
// Default booking fixture starts at 2026-12-11 08:00Z. Credit expiry anchors on
// the lesson start, so a fresh credit should expire 365 days after that.
const DEFAULT_CLASS_START = new Date("2026-12-11T08:00:00.000Z");
const OWNER_ID = "user_owner";

type UsedCreditFixture = { id: string; amountCents: number; expiresAt: Date };

function makeDeps(opts: {
  booking: BookingFixture | null;
  session?: { user: { id: string } } | null;
  now?: Date;
  /** F-060: credits USED on this booking (restored on the credit path). */
  usedCredits?: UsedCreditFixture[];
  /** F-060: credits LOCKED by this booking (released on the forfeit path). */
  lockedCreditIds?: string[];
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
  creditUpdates: Array<{
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }>;
} {
  const fixture = opts.booking;
  const usedCredits = opts.usedCredits ?? [];
  const lockedCreditIds = opts.lockedCreditIds ?? [];
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
  const creditUpdates: Array<{
    where: Record<string, unknown>;
    data: Record<string, unknown>;
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

  const creditFindMany = vi.fn(
    async (args: {
      where: { usedOnBookingId: string; status: CreditStatus };
    }) => {
      if (!fixture || args.where.usedOnBookingId !== fixture.id) return [];
      return usedCredits.map((c) => ({ ...c }));
    },
  );

  const creditUpdateMany = vi.fn(
    async (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      creditUpdates.push({ where: args.where, data: args.data });
      const where = args.where as {
        id?: { in?: string[] };
        lockedByBookingId?: string;
      };
      if (where.id?.in) return { count: where.id.in.length };
      if (where.lockedByBookingId !== undefined) {
        return { count: lockedCreditIds.length };
      }
      return { count: 0 };
    },
  );

  const prisma = {
    booking: {
      findUnique: vi.fn(async () => fixture),
    },
    $transaction: vi.fn(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          booking: { updateMany },
          accountCredit: {
            create,
            findMany: creditFindMany,
            updateMany: creditUpdateMany,
          },
        }),
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
    creditUpdates,
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
    // expiresAt anchors on the lesson start, not `now` — booker isn't penalised
    // (in remaining validity) for cancelling early.
    expect(creditCreates[0]!.expiresAt.getTime()).toBe(
      DEFAULT_CLASS_START.getTime() + CREDIT_VALIDITY_MS,
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

  test("F-060: a 100%-credit-funded booking restores the original credits, preserving expiry, mints no fresh credit", async () => {
    const originalExpiry = new Date("2027-01-15T00:00:00.000Z");
    const { deps, creditCreates, creditUpdates } = makeDeps({
      booking: makeBooking({ totalPriceCents: 11000 }),
      usedCredits: [
        { id: "cr_old", amountCents: 11000, expiresAt: originalExpiry },
      ],
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({ ok: true, outcome: "credit", creditAmountCents: 11000 });
    // No cash portion → no fresh 1-year credit minted (closes expiry-refresh loophole).
    expect(creditCreates).toHaveLength(0);
    // Reported expiry is the restored credit's ORIGINAL expiry, not now+1y.
    if (result.ok && result.outcome === "credit") {
      expect(result.creditExpiresAt.getTime()).toBe(originalExpiry.getTime());
    }
    const restore = creditUpdates.find(
      (u) => (u.where as { id?: { in?: string[] } }).id?.in,
    );
    expect(restore).toBeDefined();
    expect((restore!.where as { id: { in: string[] } }).id.in).toEqual(["cr_old"]);
    expect(restore!.data).toMatchObject({
      status: CreditStatus.ACTIVE,
      usedAt: null,
      usedOnBookingId: null,
    });
  });

  test("F-060 partial-use: cancelling a split-funded booking restores only the applied portion (the remnant already exists), conserving the original face value", async () => {
    // The booking was funded by a credit that got SPLIT at checkout: a CHF 200
    // credit covering a CHF 110 lesson is rewritten down to a 11000 USED row
    // (usedOnBookingId=book_1) and a separate 9000 ACTIVE remnant. Cancel reads
    // the USED row's *reduced* amount (11000) — it must NOT restore the 20000
    // face value, or the booker would end up with 20000 + 9000 = 29000. Restoring
    // 11000 + the untouched 9000 remnant = 20000 original. No cash → no fresh credit.
    const originalExpiry = new Date("2027-01-15T00:00:00.000Z");
    const { deps, creditCreates, creditUpdates } = makeDeps({
      booking: makeBooking({ totalPriceCents: 11000 }),
      usedCredits: [
        { id: "cr_split", amountCents: 11000, expiresAt: originalExpiry },
      ],
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({
      ok: true,
      outcome: "credit",
      creditAmountCents: 11000,
    });
    expect(creditCreates).toHaveLength(0);
    if (result.ok && result.outcome === "credit") {
      expect(result.creditExpiresAt.getTime()).toBe(originalExpiry.getTime());
    }
    const restore = creditUpdates.find(
      (u) => (u.where as { id?: { in?: string[] } }).id?.in,
    );
    expect((restore!.where as { id: { in: string[] } }).id.in).toEqual([
      "cr_split",
    ]);
    expect(restore!.data).toMatchObject({
      status: CreditStatus.ACTIVE,
      usedAt: null,
      usedOnBookingId: null,
    });
  });

  test("F-060: a partly-credit-funded booking restores credits + mints a fresh credit for the cash portion only", async () => {
    const originalExpiry = new Date("2027-01-15T00:00:00.000Z");
    const { deps, creditCreates } = makeDeps({
      booking: makeBooking({ totalPriceCents: 11000 }),
      usedCredits: [
        { id: "cr_old", amountCents: 5000, expiresAt: originalExpiry },
      ],
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    // Restored 5000 + fresh 6000 cash credit = 11000 returned in total.
    expect(result).toMatchObject({ ok: true, outcome: "credit", creditAmountCents: 11000 });
    expect(creditCreates).toHaveLength(1);
    expect(creditCreates[0]!.amountCents).toBe(6000);
    expect(creditCreates[0]!.expiresAt.getTime()).toBe(
      DEFAULT_CLASS_START.getTime() + CREDIT_VALIDITY_MS,
    );
  });

  test("F-060: forfeiting an unpaid draft releases its LOCKED credits back to ACTIVE", async () => {
    const { deps, creditUpdates, creditCreates } = makeDeps({
      booking: makeBooking({ status: BookingStatus.PENDING_PAYMENT }),
      lockedCreditIds: ["cr_locked"],
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({ ok: true, outcome: "forfeit" });
    expect(creditCreates).toHaveLength(0);
    const release = creditUpdates.find(
      (u) => (u.where as { lockedByBookingId?: string }).lockedByBookingId,
    );
    expect(release).toBeDefined();
    expect(release!.where).toMatchObject({
      lockedByBookingId: "book_1",
      status: CreditStatus.LOCKED,
    });
    expect(release!.data).toMatchObject({
      status: CreditStatus.ACTIVE,
      lockedByBookingId: null,
    });
  });

  test("F-060: forfeiting a paid <48h booking does NOT restore its USED credits", async () => {
    const { deps, creditCreates, creditUpdates } = makeDeps({
      booking: makeBooking({
        date: new Date("2026-12-03T00:00:00.000Z"),
        anchorTime: "07:00",
      }),
      usedCredits: [
        { id: "cr_old", amountCents: 11000, expiresAt: new Date("2027-01-15T00:00:00.000Z") },
      ],
    });

    const result = await cancelBookingByUserWith(deps, { bookingId: "book_1" });

    expect(result).toMatchObject({ ok: true, outcome: "forfeit" });
    expect(creditCreates).toHaveLength(0);
    // Forfeit path only releases LOCKED credits; USED credits are not restored.
    const restore = creditUpdates.find(
      (u) => (u.where as { id?: { in?: string[] } }).id?.in,
    );
    expect(restore).toBeUndefined();
  });
});
