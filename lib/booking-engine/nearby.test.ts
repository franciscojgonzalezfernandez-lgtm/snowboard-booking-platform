import { describe, it, expect } from "vitest";
import { AvailabilityKind, Duration } from "@prisma/client";
import { findNearbyDates } from "./nearby";
import { JAVI, SEASON, makeContext, weekAvailability } from "./fixtures";

// Make availability cover a wider window so we can probe "nearby" search.
const wideAvailability = (() => {
  const start = new Date("2026-11-15T00:00:00.000Z");
  const out = [];
  for (let i = 0; i < 60; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    const a = new Date(day);
    a.setUTCHours(9, 0, 0, 0);
    const b = new Date(day);
    b.setUTCHours(17, 0, 0, 0);
    out.push({
      instructorId: JAVI.id,
      startDateTime: a,
      endDateTime: b,
      kind: AvailabilityKind.AVAILABLE,
    });
  }
  return out;
})();

describe("findNearbyDates", () => {
  it("returns the closest dates around the target", () => {
    const ctx = makeContext({ availabilityBlocks: wideAvailability });
    const out = findNearbyDates(ctx, {
      date: new Date("2026-12-05T00:00:00.000Z"),
      duration: Duration.ONE_HOUR,
    });
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out).toContain("2026-12-06");
    expect(out).toContain("2026-12-04");
  });

  it("does not include the target date itself", () => {
    const ctx = makeContext({ availabilityBlocks: wideAvailability });
    const out = findNearbyDates(ctx, {
      date: new Date("2026-12-05T00:00:00.000Z"),
      duration: Duration.ONE_HOUR,
    });
    expect(out).not.toContain("2026-12-05");
  });

  it("returns at most `max` results", () => {
    const ctx = makeContext({ availabilityBlocks: wideAvailability });
    const out = findNearbyDates(ctx, {
      date: new Date("2026-12-15T00:00:00.000Z"),
      duration: Duration.ONE_HOUR,
      max: 2,
    });
    expect(out).toHaveLength(2);
  });

  it("returns empty when nothing is available in the window", () => {
    const ctx = makeContext({ availabilityBlocks: [] });
    const out = findNearbyDates(ctx, {
      date: new Date("2026-12-05T00:00:00.000Z"),
      duration: Duration.ONE_HOUR,
    });
    expect(out).toEqual([]);
  });

  it("respects a tight window", () => {
    const ctx = makeContext({
      availabilityBlocks: weekAvailability(JAVI.id, new Date("2026-12-04T00:00:00.000Z")),
    });
    const out = findNearbyDates(ctx, {
      date: new Date("2026-12-05T00:00:00.000Z"),
      duration: Duration.ONE_HOUR,
      window: 2,
      min: 1,
      max: 4,
    });
    // Days 12-06 and 12-07 should be reachable; 12-04 is the only earlier
    // day with availability in this fixture.
    for (const d of out) {
      const day = Number(d.slice(-2));
      expect(Math.abs(day - 5)).toBeLessThanOrEqual(2);
    }
  });

  it("stops early once min is reached past half the window", () => {
    // Dense availability + min 3 + window 14 should fall through the
    // half-window early-exit branch.
    const ctx = makeContext({ availabilityBlocks: wideAvailability });
    const out = findNearbyDates(ctx, {
      date: new Date("2026-12-05T00:00:00.000Z"),
      duration: Duration.ONE_HOUR,
      window: 14,
      min: 3,
      max: 10,
    });
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it("season boundary excludes dates outside the season range", () => {
    const ctx = makeContext({
      season: { ...SEASON, endDate: new Date("2026-12-10T00:00:00.000Z") },
      availabilityBlocks: wideAvailability,
    });
    const out = findNearbyDates(ctx, {
      date: new Date("2026-12-09T00:00:00.000Z"),
      duration: Duration.ONE_HOUR,
      window: 5,
      min: 1,
      max: 5,
    });
    for (const d of out) {
      expect(d <= "2026-12-10").toBe(true);
    }
  });
});
