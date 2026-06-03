import { addDays, startOfUtcDay } from "@/lib/booking-engine/time";

// Shared month-grid helpers for the instructor (`/instructor/calendar`) and
// admin (`/admin`) month calendars. Both render the same Monday-start, whole-
// week padded grid; this keeps the date math in one place.

const MONTH_RE = /^\d{4}-\d{2}$/;

export type YearMonth = { year: number; month: number };

/** Parse a `YYYY-MM` param, falling back to the month containing `now` (UTC). */
export function parseMonth(raw: string | undefined, now: Date): YearMonth {
  if (raw && MONTH_RE.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(5, 7));
    if (month >= 1 && month <= 12) return { year, month };
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function monthIso(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** `YYYY-MM` for the month `delta` months away from `{year, month}`. */
export function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthIso(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export type MonthGrid = {
  /** First day of the padded grid (a Monday, UTC midnight). */
  gridStart: Date;
  /** Last day of the padded grid (a Sunday, UTC midnight). */
  gridEnd: Date;
  monthFirst: Date;
};

/** Pad a month to whole Monday-start weeks so the grid is rectangular. */
export function monthGrid(year: number, month: number): MonthGrid {
  const monthFirst = startOfUtcDay(new Date(Date.UTC(year, month - 1, 1)));
  const monthLast = startOfUtcDay(new Date(Date.UTC(year, month, 0)));
  const firstWeekday = (monthFirst.getUTCDay() + 6) % 7;
  const lastWeekday = (monthLast.getUTCDay() + 6) % 7;
  return {
    monthFirst,
    gridStart: addDays(monthFirst, -firstWeekday),
    gridEnd: addDays(monthLast, 6 - lastWeekday),
  };
}

export function monthLabel(monthFirst: Date): string {
  return new Intl.DateTimeFormat("en-CH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthFirst);
}
