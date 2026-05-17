import type { Duration } from "@prisma/client";
import { instructorsAvailableOnDate } from "./availability";
import { addDays, startOfUtcDay, toIsoDate } from "./time";
import type { CalendarDay, EngineContext } from "./types";

export type CalendarOptions = {
  duration: Duration;
  monthFrom: Date;
  monthTo: Date;
};

/** Cap to keep callers from accidentally scanning years of days. */
export const MAX_CALENDAR_DAYS = 100;

/**
 * Returns one entry per UTC day in [monthFrom, monthTo] with availability
 * boolean + instructor count. Per PRD §6.1, language is NOT a filter here —
 * the calendar is a hard supply view; language preference is captured later
 * in Step 3.
 */
export function computeCalendar(
  ctx: EngineContext,
  opts: CalendarOptions,
): CalendarDay[] {
  const start = startOfUtcDay(opts.monthFrom);
  const end = startOfUtcDay(opts.monthTo);

  if (end < start) return [];

  const days: CalendarDay[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    if (days.length >= MAX_CALENDAR_DAYS) break;
    const instructors = instructorsAvailableOnDate(ctx, cursor, opts.duration);
    days.push({
      date: toIsoDate(cursor),
      hasAvailability: instructors.length > 0,
      instructorCount: instructors.length,
    });
  }
  return days;
}
