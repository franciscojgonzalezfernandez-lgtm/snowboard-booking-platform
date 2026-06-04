"use client";

import {
  MonthCalendar,
  type CalendarActions,
  type CalendarMode,
} from "@/components/calendar/month-calendar";
import type { CalendarDay } from "@/lib/instructor/availability";

import {
  adminBlockAvailabilityWindow,
  adminClearAvailability,
  adminCloseDayAllInstructors,
  adminOpenAvailabilityRange,
  adminOpenRangeAllInstructors,
} from "../actions";

export const ALL_INSTRUCTORS = "all";

type Props = {
  days: CalendarDay[];
  monthIso: string;
  todayIso: string;
  /** A specific instructor id, or {@link ALL_INSTRUCTORS} for every active one. */
  selected: string;
};

/**
 * Picks the action set for the {@link MonthCalendar} based on the selection:
 * a single instructor (id bound into each action) or "All instructors" (batch
 * across every active instructor — open/close by date, sub-day blocks hidden).
 * The grid itself is shared with `/instructor/calendar`.
 */
export function AdminCalendar({ days, monthIso, todayIso, selected }: Props) {
  const isAll = selected === ALL_INSTRUCTORS;
  const mode: CalendarMode = isAll ? "all" : "single";

  const actions: CalendarActions = isAll
    ? {
        openAvailabilityRange: (input) => adminOpenRangeAllInstructors(input),
        closeDay: (input) => adminCloseDayAllInstructors(input),
        // Sub-day windows are per-instructor; the all-mode UI hides them, so
        // these are never invoked. Provide no-op-safe stubs for the type.
        blockAvailabilityWindow: () =>
          Promise.resolve({ ok: false, error: "INVALID_INPUT" }),
        clearAvailability: () =>
          Promise.resolve({ ok: false, error: "INVALID_INPUT" }),
      }
    : {
        openAvailabilityRange: (input) =>
          adminOpenAvailabilityRange({ instructorId: selected, ...input }),
        blockAvailabilityWindow: (input) =>
          adminBlockAvailabilityWindow({ instructorId: selected, ...input }),
        clearAvailability: (input) =>
          adminClearAvailability({ instructorId: selected, ...input }),
      };

  return (
    <MonthCalendar
      days={days}
      monthIso={monthIso}
      todayIso={todayIso}
      mode={mode}
      actions={actions}
    />
  );
}
