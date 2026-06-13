import { BookingStatus, Duration, type Locale } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  type AgendaBooking,
  AGENDA_WINDOW_DAYS,
  buildAgendaWindow,
  endTimeHHMM,
  groupAgendaByDay,
} from "./agenda";

function makeBooking(args: {
  id: string;
  date: string;
  anchorTime: string;
  duration?: Duration;
  status?: BookingStatus;
}): AgendaBooking {
  return {
    id: args.id,
    bookerId: "u_pat",
    date: new Date(`${args.date}T00:00:00.000Z`),
    anchorTime: args.anchorTime,
    duration: args.duration ?? Duration.ONE_HOUR,
    language: "en" as Locale,
    status: args.status ?? BookingStatus.CONFIRMED,
    totalPriceCents: 11000,
    instructorNote: null,
    autoCompletedAt: null,
    attendees: [{ name: "Pat", isBooker: true }],
  };
}

describe("endTimeHHMM", () => {
  it("adds the lesson length to the start", () => {
    expect(endTimeHHMM("09:00", Duration.ONE_HOUR)).toBe("10:00");
    expect(endTimeHHMM("09:30", Duration.TWO_HOURS)).toBe("11:30");
    expect(endTimeHHMM("08:00", Duration.INTENSIVE)).toBe("12:00");
    expect(endTimeHHMM("09:00", Duration.FULL_DAY)).toBe("15:00");
  });

  it("wraps at midnight instead of throwing for an impossible late start", () => {
    // 22:00 + 6h would be 28:00; wrap keeps it a valid HH:MM.
    expect(endTimeHHMM("22:00", Duration.FULL_DAY)).toBe("04:00");
  });
});

describe("buildAgendaWindow", () => {
  it("returns AGENDA_WINDOW_DAYS contiguous UTC days from the start", () => {
    const { fromDay, days, toExclusive } = buildAgendaWindow(
      new Date("2026-12-01T15:42:00.000Z"),
    );
    expect(days).toHaveLength(AGENDA_WINDOW_DAYS);
    expect(fromDay.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(days[0]?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(days[7]?.toISOString()).toBe("2026-12-08T00:00:00.000Z");
    // Exclusive upper bound is the day after the last covered day.
    expect(toExclusive.toISOString()).toBe("2026-12-09T00:00:00.000Z");
  });
});

describe("groupAgendaByDay", () => {
  const { days } = buildAgendaWindow(new Date("2026-12-01T00:00:00.000Z"));

  it("creates one entry per window day, including empty days", () => {
    const grouped = groupAgendaByDay([], days);
    expect(grouped).toHaveLength(AGENDA_WINDOW_DAYS);
    expect(grouped.every((day) => day.bookings.length === 0)).toBe(true);
    expect(grouped[0]?.isoDate).toBe("2026-12-01");
    expect(grouped[7]?.isoDate).toBe("2026-12-08");
  });

  it("buckets bookings into their day and orders by anchorTime", () => {
    const grouped = groupAgendaByDay(
      [
        makeBooking({ id: "late", date: "2026-12-02", anchorTime: "15:00" }),
        makeBooking({ id: "early", date: "2026-12-02", anchorTime: "09:00" }),
        makeBooking({ id: "other", date: "2026-12-05", anchorTime: "11:00" }),
      ],
      days,
    );
    const dec2 = grouped.find((day) => day.isoDate === "2026-12-02");
    expect(dec2?.bookings.map((b) => b.id)).toEqual(["early", "late"]);
    const dec5 = grouped.find((day) => day.isoDate === "2026-12-05");
    expect(dec5?.bookings.map((b) => b.id)).toEqual(["other"]);
  });

  it("ignores bookings outside the window", () => {
    const grouped = groupAgendaByDay(
      [makeBooking({ id: "outside", date: "2027-01-01", anchorTime: "09:00" })],
      days,
    );
    expect(grouped.every((day) => day.bookings.length === 0)).toBe(true);
  });
});
