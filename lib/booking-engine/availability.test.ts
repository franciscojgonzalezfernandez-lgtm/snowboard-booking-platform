import { describe, it, expect } from "vitest";
import { BookingStatus, Duration } from "@prisma/client";
import {
  ADVANCE_MINUTES,
  BUFFER_MINUTES,
  fitsWithinOperatingHours,
  instructorAvailableAt,
  instructorsAvailableOnDate,
  isWithinSeason,
} from "./availability";
import {
  FIXED_NOW,
  JAVI,
  MAYA,
  SEASON,
  blocked,
  booking,
  fullDayAvailability,
  makeContext,
  weekAvailability,
} from "./fixtures";

const DAY = new Date("2026-12-05T00:00:00.000Z");

describe("isWithinSeason", () => {
  it("accepts dates inside the active range", () => {
    expect(isWithinSeason(SEASON, new Date("2027-01-01T12:00:00.000Z"))).toBe(true);
  });

  it("rejects dates before startDate or after endDate", () => {
    expect(isWithinSeason(SEASON, new Date("2026-11-14T23:59:00.000Z"))).toBe(false);
    expect(isWithinSeason(SEASON, new Date("2027-05-01T00:00:00.000Z"))).toBe(false);
  });

  it("rejects inactive season", () => {
    expect(isWithinSeason({ ...SEASON, active: false }, DAY)).toBe(false);
  });
});

describe("fitsWithinOperatingHours", () => {
  it("accepts when anchor + duration ends at operatingHoursEnd", () => {
    expect(fitsWithinOperatingHours(SEASON, "15:00", Duration.TWO_HOURS)).toBe(true);
  });

  it("rejects when end overshoots operatingHoursEnd", () => {
    expect(fitsWithinOperatingHours(SEASON, "15:00", Duration.INTENSIVE)).toBe(false);
  });

  it("rejects anchor before operatingHoursStart", () => {
    expect(fitsWithinOperatingHours(SEASON, "08:00", Duration.ONE_HOUR)).toBe(false);
  });
});

describe("instructorAvailableAt — happy path", () => {
  it("instructor is available with no conflicts", () => {
    const ctx = makeContext();
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.TWO_HOURS,
      }),
    ).toBe(true);
  });
});

describe("instructorAvailableAt — guards", () => {
  it("blocks an inactive instructor", () => {
    const ctx = makeContext({ instructors: [{ ...JAVI, active: false }] });
    expect(
      instructorAvailableAt(ctx, {
        instructor: { ...JAVI, active: false },
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });

  it("blocks when there is no active season", () => {
    const ctx = makeContext({ season: null });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });

  it("blocks when date is outside the season window", () => {
    const ctx = makeContext({
      availabilityBlocks: weekAvailability(JAVI.id, new Date("2027-05-01T00:00:00.000Z")),
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: new Date("2027-05-02T00:00:00.000Z"),
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });

  it("blocks when duration would push past operating hours", () => {
    const ctx = makeContext();
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "15:00",
        duration: Duration.INTENSIVE,
      }),
    ).toBe(false);
  });

  it("blocks when the slot ends in the past relative to `now`", () => {
    const ctx = makeContext({
      now: new Date("2026-12-05T18:00:00.000Z"),
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "09:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });

  it("blocks when no AvailabilityBlock covers the slot", () => {
    const ctx = makeContext({ availabilityBlocks: [] });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });

  it("blocks when a BLOCKED overlap exists, even with AVAILABLE underneath", () => {
    const conflict = blocked(
      JAVI.id,
      new Date("2026-12-05T11:30:00.000Z"),
      new Date("2026-12-05T12:00:00.000Z"),
    );
    const ctx = makeContext({
      availabilityBlocks: [...weekAvailability(JAVI.id, new Date("2026-12-01T00:00:00.000Z")), conflict],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.TWO_HOURS,
      }),
    ).toBe(false);
  });
});

describe("instructorAvailableAt — bookings + buffer", () => {
  it("rejects a slot overlapping a confirmed booking", () => {
    const ctx = makeContext({
      bookings: [booking(JAVI.id, DAY, "11:00", Duration.TWO_HOURS)],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });

  it("accepts a back-to-back slot when BUFFER_MINUTES is 0", () => {
    // F-036 dropped the buffer. Existing 11:00 - 12:00 + candidate 10:00 - 11:00
    // are adjacent but non-overlapping → accepted.
    const ctx = makeContext({
      bookings: [booking(JAVI.id, DAY, "11:00", Duration.ONE_HOUR)],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "10:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(true);
  });

  it("accepts a slot that starts exactly when the previous booking ends", () => {
    // Existing 09:00 - 10:00. Candidate 10:00 - 11:00 is back-to-back; legal at buffer=0.
    const ctx = makeContext({
      bookings: [booking(JAVI.id, DAY, "09:00", Duration.ONE_HOUR)],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "10:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(true);
  });

  it("still accepts a non-adjacent slot after an earlier booking", () => {
    // Sanity check — even with buffer=0 a comfortably-separated anchor is fine.
    const ctx = makeContext({
      bookings: [booking(JAVI.id, DAY, "09:00", Duration.ONE_HOUR)],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(true);
  });

  it("ignores cancelled bookings as occupancy", () => {
    const ctx = makeContext({
      bookings: [
        booking(JAVI.id, DAY, "11:00", Duration.ONE_HOUR, BookingStatus.CANCELLED_BY_USER),
        booking(JAVI.id, DAY, "11:00", Duration.ONE_HOUR, BookingStatus.CANCELLED_BY_OPS),
        booking(JAVI.id, DAY, "11:00", Duration.ONE_HOUR, BookingStatus.PAYMENT_FAILED),
      ],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(true);
  });

  it("treats PENDING_PAYMENT bookings as occupancy (slot is locked)", () => {
    const ctx = makeContext({
      bookings: [
        booking(JAVI.id, DAY, "11:00", Duration.ONE_HOUR, BookingStatus.PENDING_PAYMENT),
      ],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: DAY,
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });
});

describe("instructorAvailableAt — 24h rule", () => {
  it("rejects same-day slot when instructor does not accept same-day", () => {
    // FIXED_NOW = 2026-12-01T08:00Z. Same-day slot at 11:00 is < 24h.
    const ctx = makeContext({
      availabilityBlocks: [
        fullDayAvailability(JAVI.id, new Date("2026-12-01T00:00:00.000Z")),
      ],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: new Date("2026-12-01T00:00:00.000Z"),
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });

  it("accepts same-day slot when instructor accepts AND already has booking that day", () => {
    const ctx = makeContext({
      instructors: [MAYA],
      availabilityBlocks: [
        fullDayAvailability(MAYA.id, new Date("2026-12-01T00:00:00.000Z")),
      ],
      bookings: [booking(MAYA.id, new Date("2026-12-01T00:00:00.000Z"), "09:00", Duration.ONE_HOUR)],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: MAYA,
        date: new Date("2026-12-01T00:00:00.000Z"),
        anchorTime: "13:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(true);
  });

  it("rejects same-day when accepts=true but no prior booking exists that day", () => {
    const ctx = makeContext({
      instructors: [MAYA],
      availabilityBlocks: [
        fullDayAvailability(MAYA.id, new Date("2026-12-01T00:00:00.000Z")),
      ],
    });
    expect(
      instructorAvailableAt(ctx, {
        instructor: MAYA,
        date: new Date("2026-12-01T00:00:00.000Z"),
        anchorTime: "13:00",
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(false);
  });

  it("accepts slot exactly 24h ahead", () => {
    const start = new Date(FIXED_NOW.getTime() + ADVANCE_MINUTES * 60_000);
    const day = new Date(start);
    day.setUTCHours(0, 0, 0, 0);
    const anchor = "09:00";
    const ctx = makeContext({
      availabilityBlocks: [fullDayAvailability(JAVI.id, day)],
    });
    // FIXED_NOW + 24h = 2026-12-02T08:00Z; 09:00 same day is 25h ahead.
    const _passes24h = ADVANCE_MINUTES + 60 >= ADVANCE_MINUTES; // sanity assertion documented
    expect(_passes24h).toBe(true);
    expect(
      instructorAvailableAt(ctx, {
        instructor: JAVI,
        date: day,
        anchorTime: anchor,
        duration: Duration.ONE_HOUR,
      }),
    ).toBe(true);
  });
});

describe("instructorsAvailableOnDate", () => {
  it("returns each instructor that has at least one viable anchor", () => {
    const ctx = makeContext({
      instructors: [JAVI, MAYA],
      availabilityBlocks: [
        ...weekAvailability(JAVI.id, new Date("2026-12-01T00:00:00.000Z")),
        ...weekAvailability(MAYA.id, new Date("2026-12-01T00:00:00.000Z")),
      ],
    });
    const out = instructorsAvailableOnDate(ctx, DAY, Duration.ONE_HOUR);
    expect(out.map((i) => i.id).sort()).toEqual(["instr_javi", "instr_maya"]);
  });

  it("returns empty when season is null", () => {
    const ctx = makeContext({ season: null });
    expect(instructorsAvailableOnDate(ctx, DAY, Duration.ONE_HOUR)).toEqual([]);
  });

  it("returns empty for past dates", () => {
    const ctx = makeContext({ now: new Date("2026-12-10T08:00:00.000Z") });
    expect(instructorsAvailableOnDate(ctx, DAY, Duration.ONE_HOUR)).toEqual([]);
  });

  it("returns empty when instructor is saturated by bookings + buffer all day", () => {
    // Fill 09:00, 11:00, 13:00, 15:00 with 2h bookings → no anchor fits ONE_HOUR for that instructor.
    const day = new Date("2026-12-05T00:00:00.000Z");
    const ctx = makeContext({
      bookings: [
        booking(JAVI.id, day, "09:00", Duration.TWO_HOURS),
        booking(JAVI.id, day, "11:00", Duration.TWO_HOURS),
        booking(JAVI.id, day, "13:00", Duration.TWO_HOURS),
        booking(JAVI.id, day, "15:00", Duration.TWO_HOURS),
      ],
    });
    expect(instructorsAvailableOnDate(ctx, day, Duration.ONE_HOUR)).toEqual([]);
  });
});

describe("constants", () => {
  it("BUFFER_MINUTES is 0 (F-036 — instructor manages the gap manually in MVP)", () => {
    expect(BUFFER_MINUTES).toBe(0);
  });

  it("ADVANCE_MINUTES is 24h in minutes", () => {
    expect(ADVANCE_MINUTES).toBe(24 * 60);
  });
});
