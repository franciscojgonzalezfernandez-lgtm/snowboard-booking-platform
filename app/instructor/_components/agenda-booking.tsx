import { BookingStatus } from "@prisma/client";

import { formatChf } from "@/lib/pricing/format";

import { type AgendaBooking, endTimeHHMM } from "@/lib/instructor/agenda";

import {
  DURATION_LABEL,
  LANGUAGE_LABEL,
  STATUS_LABEL,
} from "@/lib/labels/booking";

const CANCELLED_STATUSES = new Set<BookingStatus>([
  BookingStatus.CANCELLED_BY_USER,
  BookingStatus.CANCELLED_BY_OPS,
  BookingStatus.CANCELLED_BY_SYSTEM,
  BookingStatus.REFUNDED,
]);

export function AgendaBookingItem({ booking }: { booking: AgendaBooking }) {
  const end = endTimeHHMM(booking.anchorTime, booking.duration);
  const attendeeNames =
    booking.attendees.map((attendee) => attendee.name).join(", ") || "—";
  const isCancelled = CANCELLED_STATUSES.has(booking.status);

  return (
    <li
      data-testid="agenda-booking-row"
      data-booking-id={booking.id}
      data-status={booking.status}
      className="grid gap-4 py-6 sm:grid-cols-[7rem,1fr,auto] sm:items-baseline"
    >
      <p
        data-testid="agenda-booking-time"
        className="font-display text-xl tracking-tight tabular-nums"
      >
        {booking.anchorTime}
        <span className="text-muted-foreground"> – {end}</span>
      </p>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          <span data-testid="agenda-booking-status">
            {STATUS_LABEL[booking.status]}
          </span>
          <span aria-hidden> · </span>
          <span data-testid="agenda-booking-duration">
            {DURATION_LABEL[booking.duration]}
          </span>
          <span aria-hidden> · </span>
          <span data-testid="agenda-booking-language">
            {LANGUAGE_LABEL[booking.language]}
          </span>
        </p>
        <p
          data-testid="agenda-booking-attendees"
          className={
            isCancelled
              ? "text-base text-muted-foreground line-through"
              : "text-base"
          }
        >
          {attendeeNames}
        </p>
      </div>

      <p
        data-testid="agenda-booking-total"
        className="font-display text-lg tracking-tight sm:text-right"
      >
        {formatChf(booking.totalPriceCents)}
      </p>
    </li>
  );
}
