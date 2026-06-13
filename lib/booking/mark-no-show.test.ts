import { describe, expect, test, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

import { markNoShowWith, type MarkNoShowDeps } from "./mark-no-show";

const INSTRUCTOR_ID = "instr_1";
const OTHER_INSTRUCTOR_ID = "instr_2";

type BookingFixture = {
  instructorId: string;
  status: BookingStatus;
  date: Date;
  anchorTime: string;
  autoCompletedAt: Date | null;
};

function makeBooking(overrides: Partial<BookingFixture> = {}): BookingFixture {
  return {
    instructorId: INSTRUCTOR_ID,
    status: BookingStatus.COMPLETED,
    date: new Date("2026-12-11T00:00:00.000Z"),
    anchorTime: "10:00",
    autoCompletedAt: new Date("2026-12-11T18:00:00.000Z"),
    ...overrides,
  };
}

type Captured = {
  updateMany: Array<{
    where: { id: string; status: BookingStatus; autoCompletedAt: { not: null } };
    data: { status: BookingStatus; cancelledByUserAt: Date };
  }>;
  creditCreates: number;
};

function makeDeps(opts: {
  booking: BookingFixture | null;
  instructorId?: string | null;
}): { deps: MarkNoShowDeps; captured: Captured } {
  const fixture = opts.booking;
  const captured: Captured = { updateMany: [], creditCreates: 0 };
  let liveStatus = fixture?.status ?? BookingStatus.CANCELLED_BY_USER;
  const liveAuto = fixture?.autoCompletedAt ?? null;

  const updateMany = vi.fn(async (args: Captured["updateMany"][number]) => {
    captured.updateMany.push(args);
    if (!fixture) return { count: 0 };
    const matches =
      liveStatus === args.where.status && liveAuto !== null;
    if (!matches) return { count: 0 };
    liveStatus = args.data.status;
    return { count: 1 };
  });

  const prisma = {
    booking: {
      findUnique: vi.fn(async () =>
        fixture
          ? {
              instructorId: fixture.instructorId,
              status: liveStatus,
              date: fixture.date,
              anchorTime: fixture.anchorTime,
              autoCompletedAt: liveAuto,
            }
          : null,
      ),
      updateMany,
    },
    // A no-show forfeits — no credit is ever minted. Surfaced so a regression
    // that starts minting credits would blow up loudly instead of silently.
    accountCredit: {
      create: vi.fn(async () => {
        captured.creditCreates += 1;
        return { id: "credit_should_not_exist" };
      }),
    },
  };

  return {
    deps: {
      prisma: prisma as unknown as MarkNoShowDeps["prisma"],
      instructorId: opts.instructorId ?? null,
    },
    captured,
  };
}

describe("markNoShowWith", () => {
  test("flips an auto-completed booking to CANCELLED_BY_USER at the class start, no credit", async () => {
    const { deps, captured } = makeDeps({ booking: makeBooking() });
    const result = await markNoShowWith(deps, { bookingId: "book_1" });

    expect(result).toEqual({ ok: true });
    expect(captured.updateMany).toHaveLength(1);
    expect(captured.updateMany[0]!.data.status).toBe(
      BookingStatus.CANCELLED_BY_USER,
    );
    // cancelledByUserAt == startDateTime (date + anchorTime), not "now".
    expect(captured.updateMany[0]!.data.cancelledByUserAt).toEqual(
      new Date("2026-12-11T10:00:00.000Z"),
    );
    expect(captured.creditCreates).toBe(0);
  });

  test("rejects a booking that was not auto-completed (manual COMPLETED)", async () => {
    const { deps, captured } = makeDeps({
      booking: makeBooking({ autoCompletedAt: null }),
    });
    const result = await markNoShowWith(deps, { bookingId: "book_1" });

    expect(result).toEqual({ ok: false, error: "NOT_AUTO_COMPLETED" });
    expect(captured.updateMany).toHaveLength(0);
  });

  test("rejects a non-COMPLETED booking even if autoCompletedAt is set", async () => {
    const { deps } = makeDeps({
      booking: makeBooking({ status: BookingStatus.CANCELLED_BY_USER }),
    });
    const result = await markNoShowWith(deps, { bookingId: "book_1" });
    expect(result).toEqual({ ok: false, error: "NOT_AUTO_COMPLETED" });
  });

  test("rejects when the booking belongs to another instructor (scoped caller)", async () => {
    const { deps, captured } = makeDeps({
      booking: makeBooking({ instructorId: OTHER_INSTRUCTOR_ID }),
      instructorId: INSTRUCTOR_ID,
    });
    const result = await markNoShowWith(deps, { bookingId: "book_1" });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(captured.updateMany).toHaveLength(0);
  });

  test("admin caller (instructorId null) may re-flip any instructor's booking", async () => {
    const { deps } = makeDeps({
      booking: makeBooking({ instructorId: OTHER_INSTRUCTOR_ID }),
      instructorId: null,
    });
    const result = await markNoShowWith(deps, { bookingId: "book_1" });
    expect(result).toEqual({ ok: true });
  });

  test("returns NOT_FOUND for a missing booking", async () => {
    const { deps } = makeDeps({ booking: null });
    const result = await markNoShowWith(deps, { bookingId: "nope" });
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  test("a second re-flip is a no-op (already CANCELLED_BY_USER) → NOT_AUTO_COMPLETED", async () => {
    const { deps } = makeDeps({ booking: makeBooking() });
    const first = await markNoShowWith(deps, { bookingId: "book_1" });
    expect(first).toEqual({ ok: true });
    const second = await markNoShowWith(deps, { bookingId: "book_1" });
    expect(second).toEqual({ ok: false, error: "NOT_AUTO_COMPLETED" });
  });
});
