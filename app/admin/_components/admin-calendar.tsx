"use client";

import { MonthCalendar } from "@/components/calendar/month-calendar";
import type { CalendarDay } from "@/lib/instructor/availability";

import {
  adminBlockAvailabilityWindow,
  adminClearAvailability,
  adminOpenAvailabilityRange,
} from "../actions";

type Props = {
  days: CalendarDay[];
  monthIso: string;
  todayIso: string;
  /** The instructor whose availability the admin is editing. */
  instructorId: string;
};

/**
 * Binds the selected instructor into the admin availability actions, then hands
 * the action-agnostic {@link MonthCalendar} the closures it expects. The grid
 * itself is shared with `/instructor/calendar`; only the bound instructor and
 * the role gate (server-side in the actions) differ.
 */
export function AdminCalendar({ days, monthIso, todayIso, instructorId }: Props) {
  return (
    <MonthCalendar
      days={days}
      monthIso={monthIso}
      todayIso={todayIso}
      actions={{
        openAvailabilityRange: (input) =>
          adminOpenAvailabilityRange({ instructorId, ...input }),
        blockAvailabilityWindow: (input) =>
          adminBlockAvailabilityWindow({ instructorId, ...input }),
        clearAvailability: (input) =>
          adminClearAvailability({ instructorId, ...input }),
      }}
    />
  );
}
