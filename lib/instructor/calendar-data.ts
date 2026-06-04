import { addDays, startOfUtcDay, toIsoDate } from "@/lib/booking-engine/time";
import { prisma } from "@/lib/db";

import {
  buildCalendarDays,
  OCCUPYING_BOOKING_STATUSES,
  type AvailabilityBlockRow,
  type BookingInterval,
  type CalendarDay,
} from "./availability";

export type GetInstructorCalendarArgs = {
  instructorId: string;
  /** UTC-midnight first day to display (inclusive). */
  from: Date;
  /** UTC-midnight last day to display (inclusive). */
  to: Date;
};

/**
 * Load one instructor's availability blocks + occupying bookings for the
 * display window and fold them into one entry per day. The bookings overlay is
 * the whole point: the instructor sees, per day, whether it is open, carries a
 * BLOCKED window, or holds classes — before touching anything.
 */
export async function getInstructorCalendar({
  instructorId,
  from,
  to,
}: GetInstructorCalendarArgs): Promise<CalendarDay[]> {
  const fromDay = startOfUtcDay(from);
  const toDay = startOfUtcDay(to);
  const toExclusive = addDays(toDay, 1);

  const days: Date[] = [];
  for (let day = fromDay; day.getTime() <= toDay.getTime(); day = addDays(day, 1)) {
    days.push(day);
  }

  const [blocks, bookings] = await Promise.all([
    prisma.availabilityBlock.findMany({
      where: {
        instructorId,
        startDateTime: { gte: fromDay, lt: toExclusive },
      },
      select: {
        id: true,
        startDateTime: true,
        endDateTime: true,
        kind: true,
      },
    }) as Promise<AvailabilityBlockRow[]>,
    prisma.booking.findMany({
      where: {
        instructorId,
        status: { in: [...OCCUPYING_BOOKING_STATUSES] },
        date: { gte: fromDay, lte: toDay },
      },
      select: {
        id: true,
        date: true,
        anchorTime: true,
        duration: true,
        status: true,
      },
    }) as Promise<BookingInterval[]>,
  ]);

  return buildCalendarDays(days, blocks, bookings);
}

export type GetAllInstructorsCalendarArgs = {
  /** UTC-midnight first day to display (inclusive). */
  from: Date;
  /** UTC-midnight last day to display (inclusive). */
  to: Date;
};

/**
 * Admin "All instructors" view: fold the availability blocks + occupying
 * bookings of *every active instructor* into one entry per day. A day reads as
 * `open` when any active instructor is open (`buildCalendarDays` already ORs the
 * AVAILABLE blocks); `bookings` is the union across instructors. `openBlockId`
 * is not meaningful here (many instructors) and is ignored by the all-mode UI,
 * which closes by date rather than by block id.
 */
export async function getAllInstructorsCalendar({
  from,
  to,
}: GetAllInstructorsCalendarArgs): Promise<CalendarDay[]> {
  const fromDay = startOfUtcDay(from);
  const toDay = startOfUtcDay(to);
  const toExclusive = addDays(toDay, 1);

  const days: Date[] = [];
  for (let day = fromDay; day.getTime() <= toDay.getTime(); day = addDays(day, 1)) {
    days.push(day);
  }

  const [blocks, bookings] = await Promise.all([
    prisma.availabilityBlock.findMany({
      where: {
        instructor: { active: true },
        startDateTime: { gte: fromDay, lt: toExclusive },
      },
      select: {
        id: true,
        startDateTime: true,
        endDateTime: true,
        kind: true,
      },
    }) as Promise<AvailabilityBlockRow[]>,
    prisma.booking.findMany({
      where: {
        instructor: { active: true },
        status: { in: [...OCCUPYING_BOOKING_STATUSES] },
        date: { gte: fromDay, lte: toDay },
      },
      select: {
        id: true,
        date: true,
        anchorTime: true,
        duration: true,
        status: true,
      },
    }) as Promise<BookingInterval[]>,
  ]);

  return buildCalendarDays(days, blocks, bookings);
}

export { toIsoDate };
