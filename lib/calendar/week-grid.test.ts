import { describe, expect, test } from "vitest";

import {
  hourRows,
  layoutInterval,
  mondayOf,
  parseWeek,
  ratioToTime,
  shiftWeek,
  snapMinutes,
  weekDays,
  weekLabel,
} from "./week-grid";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("mondayOf", () => {
  test("a midweek day resolves to that week's Monday", () => {
    // 2026-06-11 is a Thursday.
    expect(mondayOf(utc("2026-06-11"))).toEqual(utc("2026-06-08"));
  });

  test("Sunday resolves back to the same week's Monday", () => {
    // 2026-06-14 is a Sunday.
    expect(mondayOf(utc("2026-06-14"))).toEqual(utc("2026-06-08"));
  });

  test("Monday is a fixed point", () => {
    expect(mondayOf(utc("2026-06-08"))).toEqual(utc("2026-06-08"));
  });
});

describe("parseWeek", () => {
  const now = utc("2026-06-11");

  test("valid date returns its week's Monday", () => {
    expect(parseWeek("2026-06-13", now)).toBe("2026-06-08");
  });

  test("invalid / missing param falls back to the week of now", () => {
    expect(parseWeek(undefined, now)).toBe("2026-06-08");
    expect(parseWeek("nope", now)).toBe("2026-06-08");
    expect(parseWeek("2026-13-40", now)).toBe("2026-06-08");
  });
});

describe("weekDays", () => {
  test("returns seven Mon→Sun ISO dates", () => {
    expect(weekDays("2026-06-08")).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
    ]);
  });
});

describe("shiftWeek", () => {
  test("moves whole weeks in either direction", () => {
    expect(shiftWeek("2026-06-08", 1)).toBe("2026-06-15");
    expect(shiftWeek("2026-06-08", -1)).toBe("2026-06-01");
    expect(shiftWeek("2026-06-08", 0)).toBe("2026-06-08");
  });
});

describe("weekLabel", () => {
  test("collapses the shared month + year", () => {
    expect(weekLabel("2026-06-08")).toBe("8–14 June 2026");
  });

  test("spans two months in the same year", () => {
    // 2026-06-29 (Mon) → 2026-07-05 (Sun).
    expect(weekLabel("2026-06-29")).toBe("29 June – 5 July 2026");
  });

  test("spans the new year", () => {
    // 2025-12-29 (Mon) → 2026-01-04 (Sun).
    expect(weekLabel("2025-12-29")).toBe("29 December 2025 – 4 January 2026");
  });
});

describe("hourRows", () => {
  test("whole-hour axis inclusive of the closing hour", () => {
    const rows = hourRows("08:00", "17:00");
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ label: "08:00", topPct: 0 });
    expect(rows.at(-1)).toEqual({ label: "17:00", topPct: 100 });
  });

  test("skips hours before a non-aligned start", () => {
    const rows = hourRows("08:30", "17:00");
    expect(rows[0]!.label).toBe("09:00");
    expect(rows.at(-1)!.label).toBe("17:00");
  });

  test("empty when end is not after start", () => {
    expect(hourRows("17:00", "08:00")).toEqual([]);
  });
});

describe("layoutInterval", () => {
  test("positions an in-bounds window proportionally", () => {
    const l = layoutInterval("10:00", "12:00", "08:00", "17:00");
    expect(l).not.toBeNull();
    expect(l!.topPct).toBeCloseTo((120 / 540) * 100, 5);
    expect(l!.heightPct).toBeCloseTo((120 / 540) * 100, 5);
  });

  test("clamps to operating hours", () => {
    const l = layoutInterval("07:00", "09:00", "08:00", "17:00");
    expect(l).toEqual({ topPct: 0, heightPct: (60 / 540) * 100 });
  });

  test("returns null when entirely outside the window", () => {
    expect(layoutInterval("18:00", "19:00", "08:00", "17:00")).toBeNull();
  });

  test("returns null for an empty interval", () => {
    expect(layoutInterval("10:00", "10:00", "08:00", "17:00")).toBeNull();
  });
});

describe("snapMinutes", () => {
  test("rounds to the nearest step", () => {
    expect(snapMinutes(745, 30)).toBe(750);
    expect(snapMinutes(744, 30)).toBe(750);
    expect(snapMinutes(734, 30)).toBe(720);
  });
});

describe("ratioToTime", () => {
  test("maps the endpoints to the operating hours", () => {
    expect(ratioToTime(0, "08:00", "17:00")).toBe("08:00");
    expect(ratioToTime(1, "08:00", "17:00")).toBe("17:00");
  });

  test("snaps an interior ratio", () => {
    expect(ratioToTime(0.5, "08:00", "17:00")).toBe("12:30");
  });

  test("clamps out-of-range ratios", () => {
    expect(ratioToTime(-1, "08:00", "17:00")).toBe("08:00");
    expect(ratioToTime(2, "08:00", "17:00")).toBe("17:00");
  });
});
