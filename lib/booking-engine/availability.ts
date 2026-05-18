import { AvailabilityKind, BookingStatus, type Duration } from "@prisma/client";
import { durationMinutes } from "./duration";
import {
  addDays,
  parseHHMM,
  sameUtcDay,
  setUtcTime,
  startOfUtcDay,
} from "./time";
import type {
  EngineAvailabilityBlock,
  EngineBooking,
  EngineContext,
  EngineInstructor,
  EngineSeason,
} from "./types";

/** 10-minute buffer between consecutive lessons for the same instructor. */
// Buffer between consecutive bookings. F-036 dropped it from 10 to 0:
// the instructor manages the gap manually in MVP, and the engine no longer
// blocks back-to-back slots. Re-introduce when (a) operational complaints
// surface, or (b) Google Calendar sync (Sprint 4) needs to reserve buffer
// blocks in the external calendar.
export const BUFFER_MINUTES = 0;

/** Minimum advance time before a class for clients without prior same-day booking. */
export const ADVANCE_MINUTES = 24 * 60;

const OCCUPYING_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
]);

export function isWithinSeason(season: EngineSeason, date: Date): boolean {
  if (!season.active) return false;
  const day = startOfUtcDay(date);
  return day >= startOfUtcDay(season.startDate) && day <= startOfUtcDay(season.endDate);
}

export function fitsWithinOperatingHours(
  season: EngineSeason,
  anchorTime: string,
  duration: Duration,
): boolean {
  const opsStart = parseHHMM(season.operatingHoursStart);
  const opsEnd = parseHHMM(season.operatingHoursEnd);
  const startMin = parseHHMM(anchorTime);
  const endMin = startMin + durationMinutes(duration);
  return startMin >= opsStart && endMin <= opsEnd;
}

function bookingInterval(b: EngineBooking): { start: Date; end: Date } {
  const start = setUtcTime(b.date, b.anchorTime);
  const end = new Date(start.getTime() + durationMinutes(b.duration) * 60_000);
  return { start, end };
}

function blocksFor(
  ctx: EngineContext,
  instructorId: string,
): EngineAvailabilityBlock[] {
  return ctx.availabilityBlocks.filter((b) => b.instructorId === instructorId);
}

function bookingsFor(
  ctx: EngineContext,
  instructorId: string,
): EngineBooking[] {
  return ctx.bookings.filter(
    (b) => b.instructorId === instructorId && OCCUPYING_STATUSES.has(b.status),
  );
}

/**
 * Does the instructor have an AvailabilityBlock kind=AVAILABLE that fully
 * covers [start, end]?
 */
function hasCoveringAvailability(
  blocks: EngineAvailabilityBlock[],
  start: Date,
  end: Date,
): boolean {
  return blocks.some(
    (b) =>
      b.kind === AvailabilityKind.AVAILABLE &&
      b.startDateTime <= start &&
      b.endDateTime >= end,
  );
}

/**
 * Does the instructor have a BLOCKED block intersecting [start, end]?
 * BLOCKED wins over AVAILABLE — both can coexist in the data model.
 */
function hasBlockingOverlap(
  blocks: EngineAvailabilityBlock[],
  start: Date,
  end: Date,
): boolean {
  return blocks.some(
    (b) =>
      b.kind === AvailabilityKind.BLOCKED &&
      b.startDateTime < end &&
      b.endDateTime > start,
  );
}

function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Returns true if `[start, end]` collides with any existing booking for this
 * instructor, padded by `BUFFER_MINUTES` on both sides. With `BUFFER_MINUTES = 0`
 * (current MVP value, see F-036) back-to-back bookings are allowed.
 */
function collidesWithBooking(
  bookings: EngineBooking[],
  start: Date,
  end: Date,
): boolean {
  const bufferMs = BUFFER_MINUTES * 60_000;
  return bookings.some((b) => {
    const { start: bStart, end: bEnd } = bookingInterval(b);
    return intervalsOverlap(
      start,
      end,
      new Date(bStart.getTime() - bufferMs),
      new Date(bEnd.getTime() + bufferMs),
    );
  });
}

/**
 * 24h advance rule. The slot is allowed within 24h only when the instructor
 * has `acceptsSameDayIfBooked = true` AND already has at least one
 * occupying booking on the same calendar day (so they will be on the
 * mountain anyway).
 */
function passes24hRule(
  instructor: EngineInstructor,
  bookings: EngineBooking[],
  start: Date,
  now: Date,
): boolean {
  const minutesUntil = (start.getTime() - now.getTime()) / 60_000;
  if (minutesUntil >= ADVANCE_MINUTES) return true;
  if (minutesUntil < 0) return false;
  if (!instructor.acceptsSameDayIfBooked) return false;
  return bookings.some((b) => sameUtcDay(setUtcTime(b.date, b.anchorTime), start));
}

export type AvailabilityCheck = {
  instructor: EngineInstructor;
  date: Date;
  anchorTime: string;
  duration: Duration;
};

/**
 * Core engine predicate: can this instructor host this exact slot?
 * All other engine functions are aggregations of this check.
 */
export function instructorAvailableAt(
  ctx: EngineContext,
  check: AvailabilityCheck,
): boolean {
  const { instructor, date, anchorTime, duration } = check;

  if (!instructor.active) return false;
  if (!ctx.season || !isWithinSeason(ctx.season, date)) return false;
  if (!fitsWithinOperatingHours(ctx.season, anchorTime, duration)) return false;

  const start = setUtcTime(date, anchorTime);
  const end = new Date(start.getTime() + durationMinutes(duration) * 60_000);

  // Past slots are never available, even within ADVANCE_MINUTES window.
  if (end <= ctx.now) return false;

  const blocks = blocksFor(ctx, instructor.id);
  if (!hasCoveringAvailability(blocks, start, end)) return false;
  if (hasBlockingOverlap(blocks, start, end)) return false;

  const bookings = bookingsFor(ctx, instructor.id);
  if (collidesWithBooking(bookings, start, end)) return false;

  if (!passes24hRule(instructor, bookings, start, ctx.now)) return false;

  return true;
}

/**
 * Day-level "any availability" check, used by computeCalendar.
 * Returns the set of instructor ids that can host at least one anchor on this date.
 */
export function instructorsAvailableOnDate(
  ctx: EngineContext,
  date: Date,
  duration: Duration,
): EngineInstructor[] {
  if (!ctx.season) return [];
  const day = startOfUtcDay(date);
  const tomorrow = addDays(day, 1);
  if (tomorrow <= ctx.now) return [];

  return ctx.instructors.filter((instructor) =>
    ctx.season!.anchorTimes.some((anchor) =>
      instructorAvailableAt(ctx, {
        instructor,
        date: day,
        anchorTime: anchor,
        duration,
      }),
    ),
  );
}
