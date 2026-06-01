import {
  AvailabilityKind,
  BookingStatus,
  type Duration,
} from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import {
  addDays,
  parseHHMM,
  setUtcTime,
  startOfUtcDay,
  toIsoDate,
} from "@/lib/booking-engine/time";

// Bookings that "occupy" a slot for the purposes of the availability calendar:
// a day holding any of these is locked (the instructor can't blindly close it;
// cancelling real classes is ops-cancel F-079). Mirrors the F-072 delete guard.
export const OCCUPYING_BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.COMPLETED,
] as const;

export type TimeInterval = { startMs: number; endMs: number };

export type AvailabilityBlockRow = {
  id: string;
  startDateTime: Date;
  endDateTime: Date;
  kind: AvailabilityKind;
};

export type BookingInterval = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  status: BookingStatus;
};

/** Half-open overlap: [aStart, aEnd) intersects [bStart, bEnd). */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** A booking's UTC interval, derived from its date + anchorTime + duration. */
export function bookingInterval(b: BookingInterval): TimeInterval {
  const start = setUtcTime(startOfUtcDay(b.date), b.anchorTime);
  const startMs = start.getTime();
  return { startMs, endMs: startMs + durationMinutes(b.duration) * 60_000 };
}

/**
 * True when deleting `block` would strand an occupying booking — i.e. the block
 * overlaps a CONFIRMED / PENDING_PAYMENT / COMPLETED booking. `clearAvailability`
 * rejects in that case; cancelling the class is ops-cancel territory (F-079).
 */
export function blockOverlapsBookings(
  block: Pick<AvailabilityBlockRow, "startDateTime" | "endDateTime">,
  bookings: BookingInterval[],
): boolean {
  const blockInterval: TimeInterval = {
    startMs: block.startDateTime.getTime(),
    endMs: block.endDateTime.getTime(),
  };
  return bookings.some(
    (b) =>
      OCCUPYING_BOOKING_STATUSES.includes(
        b.status as (typeof OCCUPYING_BOOKING_STATUSES)[number],
      ) && intervalsOverlap(blockInterval, bookingInterval(b)),
  );
}

export type OpenRangeArgs = {
  /** Inclusive UTC-midnight first day. */
  fromDay: Date;
  /** Inclusive UTC-midnight last day. */
  toDay: Date;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  /** ISO dates (YYYY-MM-DD) already carrying an AVAILABLE block — skipped. */
  alreadyOpenIsoDates: ReadonlySet<string>;
};

/**
 * Build the AVAILABLE blocks to insert when opening a date range. One block per
 * day spanning the season's operating hours. Days already open are skipped so
 * the action is idempotent (re-opening a week never duplicates). Inclusive of
 * both endpoints. Returns an empty array when `fromDay > toDay`.
 */
export function buildOpenRangeBlocks({
  fromDay,
  toDay,
  operatingHoursStart,
  operatingHoursEnd,
  alreadyOpenIsoDates,
}: OpenRangeArgs): Array<{ startDateTime: Date; endDateTime: Date }> {
  const blocks: Array<{ startDateTime: Date; endDateTime: Date }> = [];
  const start = startOfUtcDay(fromDay);
  const end = startOfUtcDay(toDay);
  for (let day = start; day.getTime() <= end.getTime(); day = addDays(day, 1)) {
    const iso = toIsoDate(day);
    if (alreadyOpenIsoDates.has(iso)) continue;
    blocks.push({
      startDateTime: setUtcTime(day, operatingHoursStart),
      endDateTime: setUtcTime(day, operatingHoursEnd),
    });
  }
  return blocks;
}

export type BlockWindowValidation =
  | { ok: true; startDateTime: Date; endDateTime: Date }
  | { ok: false; error: "INVALID_RANGE" | "OUT_OF_HOURS" };

/**
 * Validate a sub-day BLOCKED window (e.g. a voluntary 2h block). `start < end`
 * and both within the season's operating hours. Returns the UTC interval to
 * persist on success.
 */
export function validateBlockWindow(args: {
  day: Date;
  startTime: string;
  endTime: string;
  operatingHoursStart: string;
  operatingHoursEnd: string;
}): BlockWindowValidation {
  const start = parseHHMM(args.startTime);
  const end = parseHHMM(args.endTime);
  if (start >= end) return { ok: false, error: "INVALID_RANGE" };
  const opStart = parseHHMM(args.operatingHoursStart);
  const opEnd = parseHHMM(args.operatingHoursEnd);
  if (start < opStart || end > opEnd) return { ok: false, error: "OUT_OF_HOURS" };
  return {
    ok: true,
    startDateTime: setUtcTime(startOfUtcDay(args.day), args.startTime),
    endDateTime: setUtcTime(startOfUtcDay(args.day), args.endTime),
  };
}

export type CalendarDay = {
  isoDate: string;
  /** Has at least one AVAILABLE block. */
  open: boolean;
  /** BLOCKED override windows on this day, as HH:MM ranges. */
  blocked: Array<{ start: string; end: string }>;
  /** Occupying bookings on this day (CONFIRMED/PENDING/COMPLETED). */
  bookings: Array<{ id: string; anchorTime: string; status: BookingStatus }>;
};

const HHMM = (d: Date): string =>
  `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

/**
 * Pure grouping: fold availability blocks + bookings into one entry per day in
 * `days`. Empty days are included so the grid can render them. This is what the
 * calendar reads to show, at a glance, which days are open, blocked, or hold
 * classes — the visibility F-072's list+form lacked.
 */
export function buildCalendarDays(
  days: Date[],
  blocks: AvailabilityBlockRow[],
  bookings: BookingInterval[],
): CalendarDay[] {
  const byIso = new Map<string, CalendarDay>();
  for (const day of days) {
    byIso.set(toIsoDate(day), {
      isoDate: toIsoDate(day),
      open: false,
      blocked: [],
      bookings: [],
    });
  }
  for (const block of blocks) {
    const iso = toIsoDate(startOfUtcDay(block.startDateTime));
    const entry = byIso.get(iso);
    if (!entry) continue;
    if (block.kind === AvailabilityKind.AVAILABLE) {
      entry.open = true;
    } else {
      entry.blocked.push({
        start: HHMM(block.startDateTime),
        end: HHMM(block.endDateTime),
      });
    }
  }
  for (const b of bookings) {
    if (
      !OCCUPYING_BOOKING_STATUSES.includes(
        b.status as (typeof OCCUPYING_BOOKING_STATUSES)[number],
      )
    ) {
      continue;
    }
    const entry = byIso.get(toIsoDate(startOfUtcDay(b.date)));
    if (!entry) continue;
    entry.bookings.push({ id: b.id, anchorTime: b.anchorTime, status: b.status });
  }
  for (const entry of byIso.values()) {
    entry.blocked.sort((a, b) => a.start.localeCompare(b.start));
    entry.bookings.sort((a, b) => a.anchorTime.localeCompare(b.anchorTime));
  }
  return days.map((day) => byIso.get(toIsoDate(day))!);
}
