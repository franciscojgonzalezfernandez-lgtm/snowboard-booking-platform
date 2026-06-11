import {
  AvailabilityKind,
  BookingStatus,
  type Duration,
} from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import {
  setUtcTime,
  startOfUtcDay,
} from "@/lib/booking-engine/time";
import {
  createAvailabilityBlockSchema,
  type CreateAvailabilityBlockInput,
} from "@/lib/schemas/availability-block";
import type { Db } from "@/lib/db";

/** Booking statuses that occupy a slot for the conflict check (subset of
 * `OCCUPYING_STATUSES` in the engine — COMPLETED can't appear inside a future
 * block we're trying to delete, so we skip it). */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

/**
 * True overlap between a booking (date + anchorTime + duration) and a block
 * window. Shared by the delete guard and the availability page badge so both
 * agree on what "this window has a booking" means.
 */
export function bookingOverlapsWindow(
  booking: { date: Date; anchorTime: string; duration: Duration },
  window: { startDateTime: Date; endDateTime: Date },
): boolean {
  const start = setUtcTime(booking.date, booking.anchorTime);
  const end = new Date(start.getTime() + durationMinutes(booking.duration) * 60_000);
  return start < window.endDateTime && window.startDateTime < end;
}

export type CreateBlockDeps = {
  prisma: Db;
  /** Resolved server-side, never trusted from the client. */
  instructorId: string;
  /** Reference clock — tests inject a fixed Date; production passes new Date(). */
  now?: Date;
};

export type DeleteBlockDeps = {
  prisma: Db;
  instructorId: string;
};

export type CreateBlockResult =
  | { ok: true; blockId: string }
  | {
      ok: false;
      error:
        | "INVALID_INPUT"
        | "OUT_OF_SEASON"
        | "OVERLAP"
        | "NO_ACTIVE_SEASON";
    };

export type DeleteBlockResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" | "HAS_ACTIVE_BOOKINGS" };

/**
 * F-072 create. Owner-side validation only — the action layer adds the
 * session / `requireInstructor` gate. All checks run against the live DB
 * (no caching) because the instructor sees the outcome immediately and a
 * stale read could let two overlapping blocks land.
 */
export async function createInstructorAvailabilityBlock(
  deps: CreateBlockDeps,
  input: CreateAvailabilityBlockInput,
): Promise<CreateBlockResult> {
  const parsed = createAvailabilityBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const { date, startTime, endTime } = parsed.data;

  const day = startOfUtcDay(new Date(`${date}T00:00:00.000Z`));
  const startDateTime = setUtcTime(day, startTime);
  const endDateTime = setUtcTime(day, endTime);

  const season = await deps.prisma.season.findFirst({
    where: { active: true },
    select: { startDate: true, endDate: true },
  });
  if (!season) {
    return { ok: false, error: "NO_ACTIVE_SEASON" };
  }
  if (
    startDateTime < season.startDate ||
    endDateTime > new Date(season.endDate.getTime() + 24 * 60 * 60 * 1000)
  ) {
    // Season.endDate is the last calendar day (00:00 UTC). A block ending on
    // that day at 17:00 must still be allowed, so we treat the season as
    // [startDate, endDate + 1d).
    return { ok: false, error: "OUT_OF_SEASON" };
  }

  const overlap = await deps.prisma.availabilityBlock.findFirst({
    where: {
      instructorId: deps.instructorId,
      // Interval overlap predicate: aStart < bEnd && bStart < aEnd. Indexed
      // via @@index([instructorId, startDateTime]) on AvailabilityBlock.
      startDateTime: { lt: endDateTime },
      endDateTime: { gt: startDateTime },
    },
    select: { id: true },
  });
  if (overlap) {
    return { ok: false, error: "OVERLAP" };
  }

  const created = await deps.prisma.availabilityBlock.create({
    data: {
      instructorId: deps.instructorId,
      startDateTime,
      endDateTime,
      kind: AvailabilityKind.AVAILABLE,
    },
    select: { id: true },
  });

  return { ok: true, blockId: created.id };
}

/**
 * F-072 delete. The block must (1) exist, (2) belong to the calling
 * instructor (ownership re-check — the URL id is client-supplied), and
 * (3) not contain any PENDING_PAYMENT / CONFIRMED bookings. Deleting a
 * block with a live booking would silently strand the booker.
 */
export async function deleteInstructorAvailabilityBlock(
  deps: DeleteBlockDeps,
  id: string,
): Promise<DeleteBlockResult> {
  const block = await deps.prisma.availabilityBlock.findUnique({
    where: { id },
    select: {
      id: true,
      instructorId: true,
      startDateTime: true,
      endDateTime: true,
    },
  });
  if (!block) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (block.instructorId !== deps.instructorId) {
    return { ok: false, error: "FORBIDDEN" };
  }

  // Booking rows store `date` (UTC midnight) + `anchorTime` (HH:MM) + duration.
  // Pull candidates for the block's day range, then JS-filter for true overlap
  // (start + duration vs block window). At MVP scale a single block spans one
  // day so this is at most a handful of rows.
  const dayStart = startOfUtcDay(block.startDateTime);
  const dayEnd = startOfUtcDay(block.endDateTime);
  const candidates = await deps.prisma.booking.findMany({
    where: {
      instructorId: block.instructorId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      date: { gte: dayStart, lte: dayEnd },
    },
    select: { date: true, anchorTime: true, duration: true },
  });
  const conflict = candidates.some((b) => bookingOverlapsWindow(b, block));
  if (conflict) {
    return { ok: false, error: "HAS_ACTIVE_BOOKINGS" };
  }

  await deps.prisma.availabilityBlock.delete({ where: { id } });
  return { ok: true };
}
