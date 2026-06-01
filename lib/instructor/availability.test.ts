import { describe, expect, test } from "vitest";
import { AvailabilityKind, BookingStatus, Duration } from "@prisma/client";

import {
  blockOverlapsBookings,
  bookingInterval,
  buildCalendarDays,
  buildOpenRangeBlocks,
  intervalsOverlap,
  validateBlockWindow,
  type AvailabilityBlockRow,
  type BookingInterval,
} from "./availability";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("intervalsOverlap", () => {
  test("half-open overlap", () => {
    expect(intervalsOverlap({ startMs: 0, endMs: 10 }, { startMs: 5, endMs: 15 })).toBe(true);
    // touching edges do not overlap
    expect(intervalsOverlap({ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 })).toBe(false);
    expect(intervalsOverlap({ startMs: 0, endMs: 10 }, { startMs: 20, endMs: 30 })).toBe(false);
  });
});

describe("bookingInterval", () => {
  test("derives UTC interval from date + anchorTime + duration", () => {
    const iv = bookingInterval({
      id: "b1",
      date: d("2026-12-20"),
      anchorTime: "10:00",
      duration: Duration.TWO_HOURS,
      status: BookingStatus.CONFIRMED,
    });
    expect(new Date(iv.startMs).toISOString()).toBe("2026-12-20T10:00:00.000Z");
    expect(new Date(iv.endMs).toISOString()).toBe("2026-12-20T12:00:00.000Z");
  });
});

describe("blockOverlapsBookings", () => {
  const block = {
    startDateTime: new Date("2026-12-20T08:00:00.000Z"),
    endDateTime: new Date("2026-12-20T17:00:00.000Z"),
  };
  const booking = (status: BookingStatus, anchorTime = "10:00"): BookingInterval => ({
    id: "b",
    date: d("2026-12-20"),
    anchorTime,
    duration: Duration.TWO_HOURS,
    status,
  });

  test("true when a CONFIRMED booking sits inside the block", () => {
    expect(blockOverlapsBookings(block, [booking(BookingStatus.CONFIRMED)])).toBe(true);
  });
  test("true for PENDING_PAYMENT and COMPLETED too", () => {
    expect(blockOverlapsBookings(block, [booking(BookingStatus.PENDING_PAYMENT)])).toBe(true);
    expect(blockOverlapsBookings(block, [booking(BookingStatus.COMPLETED)])).toBe(true);
  });
  test("ignores cancelled / failed bookings", () => {
    expect(blockOverlapsBookings(block, [booking(BookingStatus.CANCELLED_BY_USER)])).toBe(false);
    expect(blockOverlapsBookings(block, [booking(BookingStatus.PAYMENT_FAILED)])).toBe(false);
  });
  test("false when the booking is on another day", () => {
    const other: BookingInterval = { ...booking(BookingStatus.CONFIRMED), date: d("2026-12-21") };
    expect(blockOverlapsBookings(block, [other])).toBe(false);
  });
});

describe("buildOpenRangeBlocks", () => {
  test("one block per day across the inclusive range", () => {
    const blocks = buildOpenRangeBlocks({
      fromDay: d("2026-12-20"),
      toDay: d("2026-12-22"),
      operatingHoursStart: "08:00",
      operatingHoursEnd: "17:00",
      alreadyOpenIsoDates: new Set(),
    });
    expect(blocks).toHaveLength(3);
    expect(blocks[0]!.startDateTime.toISOString()).toBe("2026-12-20T08:00:00.000Z");
    expect(blocks[0]!.endDateTime.toISOString()).toBe("2026-12-20T17:00:00.000Z");
    expect(blocks[2]!.startDateTime.toISOString()).toBe("2026-12-22T08:00:00.000Z");
  });
  test("skips days already open (idempotent re-open)", () => {
    const blocks = buildOpenRangeBlocks({
      fromDay: d("2026-12-20"),
      toDay: d("2026-12-22"),
      operatingHoursStart: "08:00",
      operatingHoursEnd: "17:00",
      alreadyOpenIsoDates: new Set(["2026-12-21"]),
    });
    expect(blocks.map((b) => b.startDateTime.toISOString().slice(0, 10))).toEqual([
      "2026-12-20",
      "2026-12-22",
    ]);
  });
  test("empty when fromDay > toDay", () => {
    expect(
      buildOpenRangeBlocks({
        fromDay: d("2026-12-22"),
        toDay: d("2026-12-20"),
        operatingHoursStart: "08:00",
        operatingHoursEnd: "17:00",
        alreadyOpenIsoDates: new Set(),
      }),
    ).toHaveLength(0);
  });
});

describe("validateBlockWindow", () => {
  const base = { day: d("2026-12-20"), operatingHoursStart: "08:00", operatingHoursEnd: "17:00" };
  test("ok within hours", () => {
    const r = validateBlockWindow({ ...base, startTime: "10:00", endTime: "12:00" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.startDateTime.toISOString()).toBe("2026-12-20T10:00:00.000Z");
      expect(r.endDateTime.toISOString()).toBe("2026-12-20T12:00:00.000Z");
    }
  });
  test("INVALID_RANGE when start >= end", () => {
    expect(validateBlockWindow({ ...base, startTime: "12:00", endTime: "12:00" })).toEqual({
      ok: false,
      error: "INVALID_RANGE",
    });
  });
  test("OUT_OF_HOURS when outside operating hours", () => {
    expect(validateBlockWindow({ ...base, startTime: "07:00", endTime: "09:00" })).toEqual({
      ok: false,
      error: "OUT_OF_HOURS",
    });
    expect(validateBlockWindow({ ...base, startTime: "16:00", endTime: "18:00" })).toEqual({
      ok: false,
      error: "OUT_OF_HOURS",
    });
  });
});

describe("buildCalendarDays", () => {
  const days = [d("2026-12-20"), d("2026-12-21"), d("2026-12-22")];
  const blocks: AvailabilityBlockRow[] = [
    {
      id: "open-20",
      startDateTime: new Date("2026-12-20T08:00:00.000Z"),
      endDateTime: new Date("2026-12-20T17:00:00.000Z"),
      kind: AvailabilityKind.AVAILABLE,
    },
    {
      id: "blocked-20",
      startDateTime: new Date("2026-12-20T10:00:00.000Z"),
      endDateTime: new Date("2026-12-20T12:00:00.000Z"),
      kind: AvailabilityKind.BLOCKED,
    },
  ];
  const bookings: BookingInterval[] = [
    {
      id: "bk-21",
      date: d("2026-12-21"),
      anchorTime: "09:00",
      duration: Duration.ONE_HOUR,
      status: BookingStatus.CONFIRMED,
    },
    {
      id: "bk-cancelled",
      date: d("2026-12-21"),
      anchorTime: "13:00",
      duration: Duration.ONE_HOUR,
      status: BookingStatus.CANCELLED_BY_USER,
    },
  ];

  test("folds blocks + bookings into one entry per day; empty days included", () => {
    const result = buildCalendarDays(days, blocks, bookings);
    expect(result).toHaveLength(3);

    expect(result[0]).toMatchObject({
      isoDate: "2026-12-20",
      open: true,
      blocked: [{ start: "10:00", end: "12:00" }],
      bookings: [],
    });
    expect(result[1]).toMatchObject({
      isoDate: "2026-12-21",
      open: false,
      blocked: [],
    });
    // Only the CONFIRMED booking surfaces; cancelled is ignored.
    expect(result[1]!.bookings).toEqual([
      { id: "bk-21", anchorTime: "09:00", status: BookingStatus.CONFIRMED },
    ]);
    expect(result[2]).toMatchObject({
      isoDate: "2026-12-22",
      open: false,
      blocked: [],
      bookings: [],
    });
  });
});
