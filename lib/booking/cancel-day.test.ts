import { describe, expect, test, vi } from "vitest";
import { BookingStatus, Duration, Locale } from "@prisma/client";

import {
  cancelDayByOpsWith,
  previewCancelDayWith,
  type CancelDayBookingRow,
  type CancelDayDeps,
  type CancelOneFn,
} from "./cancel-day";

const DAY = "2026-12-11";
const DAY_START = new Date("2026-12-11T00:00:00.000Z");
const DAY_END = new Date("2026-12-12T00:00:00.000Z");

type RowOverrides = Partial<CancelDayBookingRow>;

/** The slice of Prisma's `findMany` args this suite asserts against. Deps now
 * take the full `Db` client, so we shape the recorded call locally instead of
 * deriving it from the (widened, union-typed) generated arg type. */
type FindManyWhere = {
  date: { gte: Date; lt: Date };
  status: { in: BookingStatus[] };
  instructorId?: string;
};

function makeRow(id: string, overrides: RowOverrides = {}): CancelDayBookingRow {
  return {
    id,
    anchorTime: "10:00",
    duration: Duration.ONE_HOUR,
    language: Locale.en,
    status: BookingStatus.CONFIRMED,
    totalPriceCents: 20000,
    chargeAmountCents: 20000,
    creditsAppliedCents: 0,
    stripePaymentIntentId: `pi_${id}`,
    paidAt: new Date("2026-12-01T00:00:00.000Z"),
    booker: { name: "Lara", email: `lara+${id}@example.test` },
    instructor: { id: "ins_1", user: { name: "Coach" } },
    attendees: [{ id: "att_1" }],
    ...overrides,
  };
}

function makeDeps(rows: CancelDayBookingRow[]): {
  deps: CancelDayDeps;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn(async () => rows);
  return {
    deps: {
      prisma: { booking: { findMany } } as unknown as CancelDayDeps["prisma"],
    },
    findMany,
  };
}

describe("previewCancelDayWith", () => {
  test("rejects malformed date with INVALID_INPUT", async () => {
    const { deps } = makeDeps([]);
    const res = await previewCancelDayWith(deps, { date: "not-a-date" });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("filters by exact UTC day range + cancellable statuses", async () => {
    const { deps, findMany } = makeDeps([]);
    await previewCancelDayWith(deps, { date: DAY });
    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0]![0] as { where: FindManyWhere };
    expect(args.where.date.gte).toEqual(DAY_START);
    expect(args.where.date.lt).toEqual(DAY_END);
    expect(args.where.status.in).toEqual([
      BookingStatus.CONFIRMED,
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.COMPLETED,
    ]);
    expect(args.where.instructorId).toBeUndefined();
  });

  test("forwards instructor filter when provided", async () => {
    const { deps, findMany } = makeDeps([]);
    await previewCancelDayWith(deps, { date: DAY, instructorId: "ins_42" });
    const args = findMany.mock.calls[0]![0] as { where: FindManyWhere };
    expect(args.where.instructorId).toBe("ins_42");
  });

  test("aggregates cash + credit + attendees across mixed bookings", async () => {
    const rows = [
      makeRow("b1", {
        chargeAmountCents: 9000,
        creditsAppliedCents: 11000,
        attendees: [{ id: "a1" }, { id: "a2" }],
      }),
      makeRow("b2", {
        chargeAmountCents: 20000,
        creditsAppliedCents: 0,
        attendees: [{ id: "a3" }],
      }),
      makeRow("b3", {
        status: BookingStatus.PENDING_PAYMENT,
        chargeAmountCents: 0,
        creditsAppliedCents: 0,
        stripePaymentIntentId: null,
        paidAt: null,
        attendees: [{ id: "a4" }],
      }),
    ];
    const { deps } = makeDeps(rows);
    const res = await previewCancelDayWith(deps, { date: DAY });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.preview.totals).toEqual({
      bookingsCount: 3,
      attendeesCount: 4,
      cashRefundCents: 29000,
      creditReEmitCents: 11000,
    });
    expect(res.preview.bookings.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
  });

  test("PENDING_PAYMENT contributes zero cash + zero credit", async () => {
    const rows = [
      makeRow("b1", {
        status: BookingStatus.PENDING_PAYMENT,
        chargeAmountCents: 20000,
        creditsAppliedCents: 5000,
        stripePaymentIntentId: null,
        paidAt: null,
      }),
    ];
    const { deps } = makeDeps(rows);
    const res = await previewCancelDayWith(deps, { date: DAY });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.preview.totals.cashRefundCents).toBe(0);
    expect(res.preview.totals.creditReEmitCents).toBe(0);
    expect(res.preview.bookings[0]!.cashRefundCents).toBe(0);
    expect(res.preview.bookings[0]!.creditReEmitCents).toBe(0);
  });

  test("CONFIRMED without paidAt yields zero cash refund (defensive)", async () => {
    const rows = [
      makeRow("b1", {
        status: BookingStatus.CONFIRMED,
        chargeAmountCents: 20000,
        paidAt: null,
        stripePaymentIntentId: "pi_x",
      }),
    ];
    const { deps } = makeDeps(rows);
    const res = await previewCancelDayWith(deps, { date: DAY });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.preview.bookings[0]!.cashRefundCents).toBe(0);
  });
});

describe("cancelDayByOpsWith", () => {
  test("rejects malformed date without invoking findMany", async () => {
    const { deps, findMany } = makeDeps([]);
    const cancelOne = vi.fn();
    const res = await cancelDayByOpsWith(
      deps,
      { date: "bad" },
      cancelOne as unknown as CancelOneFn,
    );
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(findMany).not.toHaveBeenCalled();
    expect(cancelOne).not.toHaveBeenCalled();
  });

  test("loops every booking, forwards reason, aggregates per-booking outcomes", async () => {
    const rows = [
      makeRow("b1", { chargeAmountCents: 9000, creditsAppliedCents: 11000 }),
      makeRow("b2", { chargeAmountCents: 20000 }),
    ];
    const { deps } = makeDeps(rows);

    const cancelOne = vi.fn(async ({ bookingId }: { bookingId: string }) => {
      if (bookingId === "b1") {
        return {
          ok: true as const,
          outcome: "mixed" as const,
          cashRefundedCents: 9000,
          creditReEmittedCents: 11000,
        };
      }
      return {
        ok: true as const,
        outcome: "cash" as const,
        cashRefundedCents: 20000,
        creditReEmittedCents: 0,
      };
    });

    const res = await cancelDayByOpsWith(
      deps,
      { date: DAY, reason: "weather" },
      cancelOne,
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(cancelOne).toHaveBeenCalledTimes(2);
    expect(cancelOne).toHaveBeenNthCalledWith(1, {
      bookingId: "b1",
      reason: "weather",
    });
    expect(cancelOne).toHaveBeenNthCalledWith(2, {
      bookingId: "b2",
      reason: "weather",
    });
    expect(res.totals).toEqual({
      attempted: 2,
      succeeded: 2,
      failed: 0,
      alreadyCancelled: 0,
      cashRefundedCents: 29000,
      creditReEmittedCents: 11000,
    });
    expect(res.results.map((r) => (r.ok ? r.outcome : r.error))).toEqual([
      "mixed",
      "cash",
    ]);
  });

  test("partial failure: one booking fails, others continue + summary reports both", async () => {
    const rows = [makeRow("b1"), makeRow("b2"), makeRow("b3")];
    const { deps } = makeDeps(rows);

    const cancelOne = vi.fn(async ({ bookingId }: { bookingId: string }) => {
      if (bookingId === "b2") {
        return { ok: false as const, error: "FORBIDDEN_STATUS" as const };
      }
      return {
        ok: true as const,
        outcome: "cash" as const,
        cashRefundedCents: 20000,
        creditReEmittedCents: 0,
      };
    });

    const res = await cancelDayByOpsWith(deps, { date: DAY }, cancelOne);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(cancelOne).toHaveBeenCalledTimes(3);
    expect(res.totals).toMatchObject({
      attempted: 3,
      succeeded: 2,
      failed: 1,
      cashRefundedCents: 40000,
    });
    const failed = res.results.find((r) => !r.ok)!;
    expect(failed).toEqual({
      bookingId: "b2",
      ok: false,
      error: "FORBIDDEN_STATUS",
    });
  });

  test("uncaught throw is captured as UNCAUGHT, loop continues", async () => {
    const rows = [makeRow("b1"), makeRow("b2")];
    const { deps } = makeDeps(rows);

    const cancelOne = vi.fn(async ({ bookingId }: { bookingId: string }) => {
      if (bookingId === "b1") throw new Error("stripe down");
      return {
        ok: true as const,
        outcome: "cash" as const,
        cashRefundedCents: 20000,
        creditReEmittedCents: 0,
      };
    });

    const res = await cancelDayByOpsWith(deps, { date: DAY }, cancelOne);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.totals).toMatchObject({
      attempted: 2,
      succeeded: 1,
      failed: 1,
    });
    const first = res.results[0]!;
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error).toBe("UNCAUGHT");
      expect(first.message).toBe("stripe down");
    }
  });

  test("idempotency: already_cancelled outcomes counted separately + no cash/credit added", async () => {
    const rows = [makeRow("b1"), makeRow("b2")];
    const { deps } = makeDeps(rows);

    const cancelOne = vi.fn(async () => ({
      ok: true as const,
      outcome: "already_cancelled" as const,
      cashRefundedCents: 0,
      creditReEmittedCents: 0,
    }));

    const res = await cancelDayByOpsWith(deps, { date: DAY }, cancelOne);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.totals).toEqual({
      attempted: 2,
      succeeded: 0,
      failed: 0,
      alreadyCancelled: 2,
      cashRefundedCents: 0,
      creditReEmittedCents: 0,
    });
  });

  test("empty day returns ok with zero totals + no cancelOne invocation", async () => {
    const { deps } = makeDeps([]);
    const cancelOne = vi.fn();
    const res = await cancelDayByOpsWith(
      deps,
      { date: DAY },
      cancelOne as unknown as CancelOneFn,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(cancelOne).not.toHaveBeenCalled();
    expect(res.totals.attempted).toBe(0);
  });

  test("instructor filter narrows the read query", async () => {
    const { deps, findMany } = makeDeps([]);
    const cancelOne = vi.fn();
    await cancelDayByOpsWith(
      deps,
      { date: DAY, instructorId: "ins_42" },
      cancelOne as unknown as CancelOneFn,
    );
    const args = findMany.mock.calls[0]![0] as { where: FindManyWhere };
    expect(args.where.instructorId).toBe("ins_42");
  });
});
