import { BookingStatus } from "@prisma/client";

import { NoShowButton } from "@/components/booking/no-show-button";
import { formatChf } from "@/lib/pricing/format";

import { type AgendaBooking, endTimeHHMM } from "@/lib/instructor/agenda";
import { type BookerNoteHistoryEntry } from "@/lib/instructor/instructor-note";

import {
  DURATION_LABEL,
  LANGUAGE_LABEL,
  STATUS_LABEL,
} from "@/lib/labels/booking";
import { markNoShow } from "../actions";
import { formatBookerHistoryDate } from "../_lib/labels";
import { InstructorNoteField } from "./instructor-note-field";

const CANCELLED_STATUSES = new Set<BookingStatus>([
  BookingStatus.CANCELLED_BY_USER,
  BookingStatus.CANCELLED_BY_OPS,
  BookingStatus.CANCELLED_BY_SYSTEM,
  BookingStatus.REFUNDED,
]);

type Props = {
  booking: AgendaBooking;
  // F-065: this booker's prior COMPLETED notes (newest first), already capped.
  // Only rendered on COMPLETED rows; the current booking is filtered out below.
  history?: BookerNoteHistoryEntry[];
};

export function AgendaBookingItem({ booking, history }: Props) {
  const end = endTimeHHMM(booking.anchorTime, booking.duration);
  const attendeeNames =
    booking.attendees.map((attendee) => attendee.name).join(", ") || "—";
  const isCancelled = CANCELLED_STATUSES.has(booking.status);
  const isCompleted = booking.status === BookingStatus.COMPLETED;
  // F-081: only auto-completed (F-062 sweep) rows offer the no-show re-flip.
  const isAutoCompleted = isCompleted && booking.autoCompletedAt !== null;

  // Previous classes by the same booker — never list the row's own booking.
  const priorNotes = isCompleted
    ? (history ?? []).filter((entry) => entry.bookingId !== booking.id)
    : [];

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

      {isCompleted ? (
        <div className="space-y-4 pt-2 sm:col-span-3">
          {isAutoCompleted ? (
            <div className="flex items-center justify-between gap-4 border-b border-input pb-4">
              <p className="text-xs text-muted-foreground">
                Auto-marked complete. Was this a no-show?
              </p>
              <NoShowButton bookingId={booking.id} action={markNoShow} size="sm" />
            </div>
          ) : null}

          <InstructorNoteField
            bookingId={booking.id}
            initialNote={booking.instructorNote ?? ""}
          />

          {priorNotes.length > 0 ? (
            <details data-testid="booker-history" className="text-sm">
              <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:underline">
                {priorNotes.length} previous{" "}
                {priorNotes.length === 1 ? "note" : "notes"} for this client
              </summary>
              <ul
                data-testid="booker-history-list"
                className="mt-3 space-y-3 border-l border-input pl-4"
              >
                {priorNotes.map((entry) => (
                  <li
                    key={entry.bookingId}
                    data-testid="booker-history-entry"
                    className="space-y-1"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {formatBookerHistoryDate(entry.date)}
                    </p>
                    <p className="whitespace-pre-wrap text-foreground/80">
                      {entry.note}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
