import { BookingStatus, type Duration } from "@prisma/client";

import { instructorAvailableAt } from "@/lib/booking-engine/availability";
import { loadEngineContext } from "@/lib/booking-engine/load-context";
import { setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";
import type { Db } from "@/lib/db";
import type { RescheduleBookingInput } from "@/lib/schemas/reschedule";

/**
 * F-157 — move (reschedule) a confirmed booking.
 *
 * Why this is the "nice" path next to cancel: a move keeps the SAME booking row
 * — same duration, same `totalPriceCents`/`chargeAmountCents`/credits/promo —
 * and only relocates it in time. No new PaymentIntent, no credit minting, no
 * refund: the booker keeps the exact effective price they already paid.
 *
 * Mechanically a slot is "occupied" purely by a booking row in an occupying
 * status (see lib/booking-engine/availability.ts), so relocating the row's
 * `date`/`anchorTime` frees the old slot and fills the new one in one write.
 */

/** Minimum notice before the CURRENT lesson start to be allowed to move it.
 *  Mirrors the 48h cancellation window (CREDIT_WINDOW_HOURS) so Move and Cancel
 *  share the same cutoff. Enforced here (server) AND mirrored in the UI. */
export const RESCHEDULE_WINDOW_HOURS = 48;

/** One-year horizon for a moved lesson, so repeated moves can't postpone a
 *  lesson indefinitely. Anchored on the ORIGINAL lesson date (see below). 365d
 *  fixed, matching CREDIT_VALIDITY_MS. */
export const RESCHEDULE_HORIZON_MS = 365 * 24 * 60 * 60 * 1000;

/** Only a CONFIRMED (paid) booking can be moved. A PENDING_PAYMENT draft is
 *  finished or discarded, never moved; COMPLETED and the CANCELLED_* / REFUNDED
 *  / PAYMENT_FAILED states are terminal. */
const RESCHEDULABLE_STATUSES = [BookingStatus.CONFIRMED] as const;

export type RescheduleBookingDeps = {
  /** Pre-resolved session from the framework; null if anonymous. */
  session: { user: { id: string } } | null;
  prisma: Db;
  /** Raw Prisma client for `loadEngineContext` — same split as create-draft,
   *  where the pure decision takes the client to hydrate the engine. */
  enginePrisma: Parameters<typeof loadEngineContext>[0];
  /** Reference clock — tests inject a fixed Date, production passes new Date(). */
  now?: Date;
};

export type RescheduleBookingError =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  /** Status is not CONFIRMED (already cancelled/completed, or a lost race). */
  | "NOT_RESCHEDULABLE"
  /** Inside the 48h notice window on the current lesson. */
  | "TOO_LATE"
  /** New date is more than a year past the original lesson date. */
  | "OUTSIDE_HORIZON"
  /** New slot is identical to the current one — nothing to do. */
  | "SAME_SLOT"
  /** New slot failed the availability engine (taken, blocked, off-hours, too
   *  soon, no such active instructor). */
  | "SLOT_TAKEN";

export type RescheduleBookingResult =
  | {
      ok: true;
      duration: Duration;
      oldDate: Date;
      oldAnchorTime: string;
      newDate: Date;
      newAnchorTime: string;
    }
  | { ok: false; error: RescheduleBookingError };

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Pure reschedule logic. The thin Server Action wrapper resolves the session and
 * dispatches the reschedule emails + Google Calendar move + cache busting after
 * this returns; every DB decision lives here so it can be unit-tested without
 * the framework.
 */
export async function rescheduleBookingWith(
  deps: RescheduleBookingDeps,
  input: RescheduleBookingInput,
): Promise<RescheduleBookingResult> {
  const { session, prisma, enginePrisma } = deps;
  const now = deps.now ?? new Date();

  if (!session?.user) return { ok: false, error: "UNAUTHORIZED" };

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      bookerId: true,
      status: true,
      date: true,
      anchorTime: true,
      duration: true,
      instructorId: true,
      originalDate: true,
    },
  });
  if (!booking) return { ok: false, error: "NOT_FOUND" };
  if (booking.bookerId !== session.user.id) return { ok: false, error: "FORBIDDEN" };
  if (!RESCHEDULABLE_STATUSES.includes(booking.status as never)) {
    return { ok: false, error: "NOT_RESCHEDULABLE" };
  }

  // 48h gate on the CURRENT lesson start (same math as cancel.ts).
  const currentStart = setUtcTime(startOfUtcDay(booking.date), booking.anchorTime);
  const hoursBeforeStart =
    (currentStart.getTime() - now.getTime()) / (60 * 60 * 1000);
  if (hoursBeforeStart < RESCHEDULE_WINDOW_HOURS) {
    return { ok: false, error: "TOO_LATE" };
  }

  const newDay = startOfUtcDay(dateOnly(input.newDate));

  // One-year horizon anchored on the ORIGINAL lesson date. `originalDate` is
  // null until the first move, so a not-yet-moved booking anchors on its current
  // date; once set it is never overwritten, so moving again still measures from
  // where the lesson started. Compared day-to-day (both UTC midnight), so a
  // lesson exactly one year out is allowed and 366 days out is not.
  const anchorDay = startOfUtcDay(booking.originalDate ?? booking.date);
  if (newDay.getTime() > anchorDay.getTime() + RESCHEDULE_HORIZON_MS) {
    return { ok: false, error: "OUTSIDE_HORIZON" };
  }

  // No-op guard: moving to the identical slot changes nothing.
  const currentDay = startOfUtcDay(booking.date);
  if (
    newDay.getTime() === currentDay.getTime() &&
    input.newAnchorTime === booking.anchorTime &&
    input.newInstructorId === booking.instructorId
  ) {
    return { ok: false, error: "SAME_SLOT" };
  }

  // Availability re-check on the NEW slot, EXCLUDING this booking from the
  // occupancy set so a move onto a slot overlapping its own current time isn't
  // counted as a self-collision. Mirrors create-draft's re-check (and its
  // SLOT_TAKEN contract for a missing/inactive instructor). The engine also
  // enforces season, operating hours, blocks, the 24h-advance rule and past
  // slots on the new slot for free.
  const ctx = await loadEngineContext(enginePrisma, { from: newDay, to: newDay, now });
  const ctxExcludingSelf = {
    ...ctx,
    bookings: ctx.bookings.filter((b) => b.id !== booking.id),
  };
  const instructor = ctxExcludingSelf.instructors.find(
    (i) => i.id === input.newInstructorId,
  );
  if (!instructor) return { ok: false, error: "SLOT_TAKEN" };
  const available = instructorAvailableAt(ctxExcludingSelf, {
    instructor,
    date: newDay,
    anchorTime: input.newAnchorTime,
    duration: booking.duration,
  });
  if (!available) return { ok: false, error: "SLOT_TAKEN" };

  // Atomic move. Guarded on status=CONFIRMED so a concurrent cancel/complete/
  // move makes the second writer match 0 rows -> NOT_RESCHEDULABLE. A single
  // updateMany is atomic on its own; no surrounding transaction is needed
  // because NO other row is written — crucially, no price/credit/discount field
  // is touched, so the booker keeps the exact effective price they paid.
  const moved = await prisma.booking.updateMany({
    where: { id: booking.id, status: BookingStatus.CONFIRMED },
    data: {
      date: newDay,
      anchorTime: input.newAnchorTime,
      instructorId: input.newInstructorId,
      // Set the horizon anchor once, on the first move only.
      originalDate: booking.originalDate ?? currentDay,
      rescheduledAt: now,
      rescheduleCount: { increment: 1 },
    },
  });
  if (moved.count === 0) return { ok: false, error: "NOT_RESCHEDULABLE" };

  return {
    ok: true,
    duration: booking.duration,
    oldDate: booking.date,
    oldAnchorTime: booking.anchorTime,
    newDate: newDay,
    newAnchorTime: input.newAnchorTime,
  };
}
