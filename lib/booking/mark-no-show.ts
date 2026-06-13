import { BookingStatus } from "@prisma/client";

import { setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";
import type { Db } from "@/lib/db";

/**
 * F-081: re-flip an *auto-completed* booking to a no-show.
 *
 * F-062 optimistically sweeps past bookings to `COMPLETED` (stamping
 * `autoCompletedAt`). When the class was actually a no-show, the owner re-flips
 * it to `CANCELLED_BY_USER` with `cancelledByUserAt = startDateTime` — a forfeit
 * with **no** credit emitted (aligned with the <48h user-cancel policy, F-039b).
 *
 * Pure logic; the thin Server Action wrappers (`app/admin/actions.ts` for the
 * admin booking detail F-077, `app/instructor/actions.ts` for the agenda F-071)
 * resolve the session + revalidate around it. The admin wrapper passes
 * `instructorId: null` (no ownership constraint); the instructor wrapper passes
 * its own id so an instructor can only touch their own classes.
 *
 * Guards, in order:
 *   - booking does not exist                       → NOT_FOUND
 *   - owned by another instructor (when scoped)    → FORBIDDEN
 *   - not COMPLETED, or not auto-completed         → NOT_AUTO_COMPLETED
 *
 * The flip is a gated `updateMany(where: { id, status: COMPLETED,
 * autoCompletedAt != null })`: a second click (already re-flipped to
 * CANCELLED_BY_USER) matches 0 rows and returns NOT_AUTO_COMPLETED instead of
 * re-stamping. `autoCompletedAt` is deliberately left set — it records that the
 * row *was* auto-completed (audit), and the status guard already blocks repeats.
 */

export type MarkNoShowInput = { bookingId: string };

export type MarkNoShowResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" | "NOT_AUTO_COMPLETED" };

export type MarkNoShowDeps = {
  prisma: Db;
  /** When set, the booking must belong to this instructor. `null` = admin (no
   *  ownership constraint). */
  instructorId: string | null;
};

export async function markNoShowWith(
  deps: MarkNoShowDeps,
  input: MarkNoShowInput,
): Promise<MarkNoShowResult> {
  const booking = await deps.prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      instructorId: true,
      status: true,
      date: true,
      anchorTime: true,
      autoCompletedAt: true,
    },
  });
  if (!booking) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (deps.instructorId !== null && booking.instructorId !== deps.instructorId) {
    return { ok: false, error: "FORBIDDEN" };
  }
  if (
    booking.status !== BookingStatus.COMPLETED ||
    booking.autoCompletedAt === null
  ) {
    return { ok: false, error: "NOT_AUTO_COMPLETED" };
  }

  const startDateTime = setUtcTime(
    startOfUtcDay(booking.date),
    booking.anchorTime,
  );

  const flipped = await deps.prisma.booking.updateMany({
    where: {
      id: input.bookingId,
      status: BookingStatus.COMPLETED,
      autoCompletedAt: { not: null },
    },
    data: {
      status: BookingStatus.CANCELLED_BY_USER,
      cancelledByUserAt: startDateTime,
    },
  });
  if (flipped.count === 0) {
    // Lost a race with a concurrent flip between the read and the update.
    return { ok: false, error: "NOT_AUTO_COMPLETED" };
  }

  return { ok: true };
}
