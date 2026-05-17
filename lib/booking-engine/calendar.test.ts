import { describe, it, expect } from "vitest";
import { Duration } from "@prisma/client";
import { computeCalendar, MAX_CALENDAR_DAYS } from "./calendar";
import { makeContext, JAVI, MAYA, weekAvailability } from "./fixtures";

describe("computeCalendar", () => {
  it("returns one entry per day in [monthFrom, monthTo]", () => {
    const ctx = makeContext();
    const days = computeCalendar(ctx, {
      duration: Duration.ONE_HOUR,
      monthFrom: new Date("2026-12-02T00:00:00.000Z"),
      monthTo: new Date("2026-12-07T00:00:00.000Z"),
    });
    expect(days.map((d) => d.date)).toEqual([
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
      "2026-12-07",
    ]);
  });

  it("marks days without availability with count 0", () => {
    const ctx = makeContext({ availabilityBlocks: [] });
    const days = computeCalendar(ctx, {
      duration: Duration.ONE_HOUR,
      monthFrom: new Date("2026-12-02T00:00:00.000Z"),
      monthTo: new Date("2026-12-03T00:00:00.000Z"),
    });
    for (const d of days) {
      expect(d.hasAvailability).toBe(false);
      expect(d.instructorCount).toBe(0);
    }
  });

  it("counts every viable instructor for the day", () => {
    const ctx = makeContext({
      instructors: [JAVI, MAYA],
      availabilityBlocks: [
        ...weekAvailability(JAVI.id, new Date("2026-12-01T00:00:00.000Z")),
        ...weekAvailability(MAYA.id, new Date("2026-12-01T00:00:00.000Z")),
      ],
    });
    const days = computeCalendar(ctx, {
      duration: Duration.ONE_HOUR,
      monthFrom: new Date("2026-12-05T00:00:00.000Z"),
      monthTo: new Date("2026-12-05T00:00:00.000Z"),
    });
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "2026-12-05",
      hasAvailability: true,
      instructorCount: 2,
    });
  });

  it("returns empty when monthTo precedes monthFrom", () => {
    const ctx = makeContext();
    expect(
      computeCalendar(ctx, {
        duration: Duration.ONE_HOUR,
        monthFrom: new Date("2026-12-10T00:00:00.000Z"),
        monthTo: new Date("2026-12-05T00:00:00.000Z"),
      }),
    ).toEqual([]);
  });

  it("caps output length at MAX_CALENDAR_DAYS to keep the API bounded", () => {
    const ctx = makeContext();
    const days = computeCalendar(ctx, {
      duration: Duration.ONE_HOUR,
      monthFrom: new Date("2026-11-15T00:00:00.000Z"),
      monthTo: new Date("2027-04-30T00:00:00.000Z"),
    });
    expect(days).toHaveLength(MAX_CALENDAR_DAYS);
  });
});
