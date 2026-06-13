import { addDays, formatHHMM, parseHHMM, startOfUtcDay, toIsoDate } from "@/lib/booking-engine/time";

// Week-timeline helpers for the instructor calendar's Week view (F-083). The
// Month grid (`month-grid.ts`) answers "which days are open/blocked/booked"; the
// Week view zooms into a single Monday-start week and paints the day on a
// vertical time axis (operating hours). All times here are naive wall-clock
// HH:MM — the same convention `AvailabilityBlock`/`anchorTime` use; no UTC
// conversion happens until the .ics boundary (see `zurichWallClockToUtc`).

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

/** UTC-midnight Monday of the week containing `day`. */
export function mondayOf(day: Date): Date {
  const start = startOfUtcDay(day);
  const back = (start.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(start, -back);
}

/**
 * Parse a `?week=YYYY-MM-DD` param to the ISO date of that week's Monday,
 * falling back to the week containing `now`. Any day in the week resolves to
 * the same Monday, so links need not pin the Monday exactly.
 */
export function parseWeek(raw: string | undefined, now: Date): string {
  if (raw && WEEK_RE.test(raw)) {
    const d = new Date(`${raw}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return toIsoDate(mondayOf(d));
  }
  return toIsoDate(mondayOf(now));
}

/** The seven ISO dates (Mon→Sun) of the week starting at `mondayIso`. */
export function weekDays(mondayIso: string): string[] {
  const monday = new Date(`${mondayIso}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(monday, i)));
}

/** ISO Monday of the week `delta` weeks away from `mondayIso`. */
export function shiftWeek(mondayIso: string, delta: number): string {
  const monday = new Date(`${mondayIso}T00:00:00.000Z`);
  return toIsoDate(addDays(monday, delta * 7));
}

/** "9–15 June 2026", collapsing the shared month/year across the range. */
export function weekLabel(mondayIso: string): string {
  const monday = new Date(`${mondayIso}T00:00:00.000Z`);
  const sunday = addDays(monday, 6);
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CH", { day: "numeric", timeZone: "UTC" }).format(d);
  const month = (d: Date) =>
    new Intl.DateTimeFormat("en-CH", { month: "long", timeZone: "UTC" }).format(d);
  const year = (d: Date) =>
    new Intl.DateTimeFormat("en-CH", { year: "numeric", timeZone: "UTC" }).format(d);

  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  const sameYear = monday.getUTCFullYear() === sunday.getUTCFullYear();

  if (sameMonth) {
    return `${day(monday)}–${day(sunday)} ${month(monday)} ${year(monday)}`;
  }
  if (sameYear) {
    return `${day(monday)} ${month(monday)} – ${day(sunday)} ${month(sunday)} ${year(monday)}`;
  }
  return `${day(monday)} ${month(monday)} ${year(monday)} – ${day(sunday)} ${month(sunday)} ${year(sunday)}`;
}

export type HourRow = {
  /** "HH:00" axis label. */
  label: string;
  /** Top position (0–100) of this hour line within the timeline. */
  topPct: number;
};

/**
 * Whole-hour axis rows from `opStart` (floored to the hour) through `opEnd`
 * (ceiled), each with its vertical position so the component can draw gridlines
 * and labels. Inclusive of the closing hour.
 */
export function hourRows(opStart: string, opEnd: string): HourRow[] {
  const startMin = parseHHMM(opStart);
  const endMin = parseHHMM(opEnd);
  const span = endMin - startMin;
  if (span <= 0) return [];
  const firstHour = Math.floor(startMin / 60);
  const lastHour = Math.ceil(endMin / 60);
  const rows: HourRow[] = [];
  for (let h = firstHour; h <= lastHour; h++) {
    const min = h * 60;
    if (min < startMin || min > endMin) continue;
    rows.push({
      label: `${String(h).padStart(2, "0")}:00`,
      topPct: ((min - startMin) / span) * 100,
    });
  }
  return rows;
}

export type IntervalLayout = { topPct: number; heightPct: number };

/**
 * Position a [start, end) wall-clock interval on the operating-hours axis as
 * top/height percentages, clamped to the visible window. Returns null when the
 * interval falls entirely outside operating hours or is empty after clamping —
 * the caller skips painting it.
 */
export function layoutInterval(
  startHHMM: string,
  endHHMM: string,
  opStart: string,
  opEnd: string,
): IntervalLayout | null {
  const opStartMin = parseHHMM(opStart);
  const opEndMin = parseHHMM(opEnd);
  const span = opEndMin - opStartMin;
  if (span <= 0) return null;

  const start = Math.max(parseHHMM(startHHMM), opStartMin);
  const end = Math.min(parseHHMM(endHHMM), opEndMin);
  if (end <= start) return null;

  return {
    topPct: ((start - opStartMin) / span) * 100,
    heightPct: ((end - start) / span) * 100,
  };
}

/** Round `minutes` to the nearest `step` (default 30) for drag-select snapping. */
export function snapMinutes(minutes: number, step = 30): number {
  return Math.round(minutes / step) * step;
}

/**
 * Map a pointer offset within the timeline to a snapped wall-clock HH:MM on the
 * operating-hours axis. `ratio` is offsetY / timelineHeight (0 at the top =
 * opStart). Clamped to [opStart, opEnd].
 */
export function ratioToTime(
  ratio: number,
  opStart: string,
  opEnd: string,
  step = 30,
): string {
  const opStartMin = parseHHMM(opStart);
  const opEndMin = parseHHMM(opEnd);
  const clamped = Math.min(1, Math.max(0, ratio));
  const raw = opStartMin + clamped * (opEndMin - opStartMin);
  const snapped = Math.min(opEndMin, Math.max(opStartMin, snapMinutes(raw, step)));
  return formatHHMM(snapped);
}
