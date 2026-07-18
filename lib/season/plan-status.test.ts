import { describe, expect, it } from "vitest";

import { seasonStatus } from "@/lib/season/plan-status";

const WINTER = {
  startDate: new Date("2026-11-15T00:00:00.000Z"),
  endDate: new Date("2027-04-30T00:00:00.000Z"),
};

describe("seasonStatus (F-115)", () => {
  it("is 'upcoming' before the season starts", () => {
    expect(seasonStatus(WINTER, new Date("2026-07-18T12:00:00Z"))).toEqual({
      kind: "upcoming",
      startDate: WINTER.startDate,
      endDate: WINTER.endDate,
    });
  });

  it("is 'active' inside the window", () => {
    expect(seasonStatus(WINTER, new Date("2026-12-20T09:00:00Z"))).toEqual({
      kind: "active",
      endDate: WINTER.endDate,
    });
  });

  it("stays 'active' through the whole last day (UTC-day granularity)", () => {
    expect(seasonStatus(WINTER, new Date("2027-04-30T22:00:00Z"))).toEqual({
      kind: "active",
      endDate: WINTER.endDate,
    });
  });

  it("is 'none' once the season has ended", () => {
    expect(seasonStatus(WINTER, new Date("2027-05-01T00:00:00Z"))).toEqual({
      kind: "none",
    });
  });

  it("is 'none' when there is no season row", () => {
    expect(seasonStatus(null, new Date("2026-12-20T09:00:00Z"))).toEqual({
      kind: "none",
    });
  });
});
