import { BookingStatus, type Duration, type Locale } from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import {
  addDays,
  formatHHMM,
  parseHHMM,
  startOfUtcDay,
  toIsoDate,
} from "@/lib/booking-engine/time";
import { prisma } from "@/lib/db";

// Statuses the instructor agenda surfaces by default. Cancellations are hidden
// unless the viewer opts in (see `includeCancelled`); a row the instructor can
// no longer act on is noise on the morning agenda.
export const AGENDA_ACTIVE_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.PENDING_PAYMENT,
] as const;

// Surfaced only with the "show cancelled" toggle.
export const AGENDA_CANCELLED_STATUSES = [
  BookingStatus.CANCELLED_BY_USER,
  BookingStatus.CANCELLED_BY_OPS,
] as const;

// Default window: today + the next 7 days (8 calendar days inclusive).
export const AGENDA_WINDOW_DAYS = 8;

export type AgendaAttendee = {
  name: string;
  isBooker: boolean;
};

export type AgendaBooking = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  status: BookingStatus;
  totalPriceCents: number;
  attendees: AgendaAttendee[];
};

export type AgendaDay = {
  isoDate: string;
  date: Date;
  bookings: AgendaBooking[];
};

/**
 * End time of a class as a wall-clock `HH:MM` string. `anchorTime` is the
 * stored slot label (Europe/Zurich wall clock); we add the lesson length and
 * wrap at midnight defensively so a hypothetical late `FULL_DAY` start never
 * throws (`formatHHMM` rejects values ≥ 24:00).
 */
export function endTimeHHMM(anchorTime: string, duration: Duration): string {
  const end = (parseHHMM(anchorTime) + durationMinutes(duration)) % (24 * 60);
  return formatHHMM(end);
}

type AgendaWindow = {
  fromDay: Date;
  days: Date[];
  toExclusive: Date;
};

/** Build the inclusive list of UTC-midnight days covered by the window. */
export function buildAgendaWindow(
  from: Date,
  windowDays: number = AGENDA_WINDOW_DAYS,
): AgendaWindow {
  const fromDay = startOfUtcDay(from);
  const days: Date[] = [];
  for (let i = 0; i < windowDays; i += 1) {
    days.push(addDays(fromDay, i));
  }
  return { fromDay, days, toExclusive: addDays(fromDay, windowDays) };
}

/**
 * Pure grouping: bucket bookings into one entry per day in `days` (empty days
 * included so the view can render an empty state). Bookings inside each day are
 * ordered by `anchorTime` ascending. Rows outside the window are ignored.
 */
export function groupAgendaByDay(
  bookings: AgendaBooking[],
  days: Date[],
): AgendaDay[] {
  const byIso = new Map<string, AgendaBooking[]>();
  for (const day of days) {
    byIso.set(toIsoDate(day), []);
  }
  for (const booking of bookings) {
    byIso.get(toIsoDate(booking.date))?.push(booking);
  }
  return days.map((day) => {
    const isoDate = toIsoDate(day);
    const dayBookings = byIso.get(isoDate)!;
    dayBookings.sort((a, b) => a.anchorTime.localeCompare(b.anchorTime));
    return { isoDate, date: day, bookings: dayBookings };
  });
}

export type GetInstructorAgendaArgs = {
  instructorId: string;
  from: Date;
  windowDays?: number;
  includeCancelled?: boolean;
};

/** Load + group one instructor's bookings for the agenda window. */
export async function getInstructorAgenda({
  instructorId,
  from,
  windowDays = AGENDA_WINDOW_DAYS,
  includeCancelled = false,
}: GetInstructorAgendaArgs): Promise<AgendaDay[]> {
  const { days, fromDay, toExclusive } = buildAgendaWindow(from, windowDays);
  const statuses = includeCancelled
    ? [...AGENDA_ACTIVE_STATUSES, ...AGENDA_CANCELLED_STATUSES]
    : [...AGENDA_ACTIVE_STATUSES];

  const bookings = (await prisma.booking.findMany({
    where: {
      instructorId,
      status: { in: statuses },
      date: { gte: fromDay, lt: toExclusive },
    },
    orderBy: [{ date: "asc" }, { anchorTime: "asc" }],
    select: {
      id: true,
      date: true,
      anchorTime: true,
      duration: true,
      language: true,
      status: true,
      totalPriceCents: true,
      attendees: {
        select: { name: true, isBooker: true },
        orderBy: { isBooker: "desc" },
      },
    },
  })) as AgendaBooking[];

  return groupAgendaByDay(bookings, days);
}
