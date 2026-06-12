import { BookingStatus } from "@prisma/client";

import type {
  DashboardBookingRow,
  DashboardCreditRow,
} from "@/lib/dashboard/overview";

// Mirror of `IDEMPOTENCY_WINDOW_MS` in lib/booking/create-draft.ts. The dashboard
// uses the same 15-minute window to decide whether a PENDING_PAYMENT row is
// still resumable. After this window the booking is considered stale; the
// daily cron in lib/cron/booking-emails.ts flips it to PAYMENT_FAILED, but the
// dashboard filter is what guarantees the booker never sees a row they can no
// longer pay (no lag between the abandonment and the next cron run).
export const PENDING_PAYMENT_WINDOW_MS = 15 * 60 * 1000;

export type SectionKind = "pending" | "upcoming" | "past" | "cancelled";

// Row shapes are owned by the loader's Prisma selects (F-086d) — these aliases
// keep the dashboard components' imports stable while making the select the
// single source of truth for the shape.
export type BookingRow = DashboardBookingRow;
export type CreditRow = DashboardCreditRow;

// `Booking.date` is `@db.Date` (UTC midnight). "Today" must be the UTC date
// midnight so date-only comparisons stay consistent regardless of server TZ.
export function utcStartOfToday(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function classifyBooking(
  booking: Pick<BookingRow, "status" | "date" | "createdAt">,
  today: Date,
  now: Date,
): SectionKind | null {
  switch (booking.status) {
    case BookingStatus.PENDING_PAYMENT: {
      // Only surface drafts the booker can still pay. After the 15-minute
      // idempotency window the PaymentIntent is effectively dead, so hiding
      // here prevents broken CTAs even if the cron has not run yet.
      const cutoff = now.getTime() - PENDING_PAYMENT_WINDOW_MS;
      return booking.createdAt.getTime() > cutoff ? "pending" : null;
    }
    case BookingStatus.CONFIRMED:
      return booking.date.getTime() >= today.getTime() ? "upcoming" : "past";
    case BookingStatus.COMPLETED:
      return "past";
    case BookingStatus.CANCELLED_BY_USER:
    case BookingStatus.CANCELLED_BY_OPS:
      return "cancelled";
    case BookingStatus.CANCELLED_BY_SYSTEM:
    case BookingStatus.REFUNDED:
    case BookingStatus.PAYMENT_FAILED:
      // System cancellations, refunds and payment failures are not actionable
      // history for the booker — hidden from the dashboard. Admin tooling
      // (Sprint 4) surfaces them where they matter.
      return null;
  }
}

export type GroupedBookings = Record<SectionKind, BookingRow[]>;

export function groupBookings(
  bookings: BookingRow[],
  now: Date = new Date(),
): GroupedBookings {
  const today = utcStartOfToday(now);
  const groups: GroupedBookings = {
    pending: [],
    upcoming: [],
    past: [],
    cancelled: [],
  };
  for (const booking of bookings) {
    const kind = classifyBooking(booking, today, now);
    if (kind) groups[kind].push(booking);
  }
  // Pending + Upcoming read better ascending (soonest deadline / nearest
  // class first); Past + Cancelled stay desc (most recent on top).
  groups.pending.reverse();
  groups.upcoming.reverse();
  return groups;
}
