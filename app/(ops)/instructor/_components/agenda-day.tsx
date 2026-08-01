import { type AgendaDay } from "@/lib/instructor/agenda";
import { type BookerNoteHistoryEntry } from "@/lib/instructor/instructor-note";

import { formatAgendaDayHeader } from "../_lib/labels";
import { AgendaBookingItem } from "./agenda-booking";

type Props = {
  day: AgendaDay;
  isToday: boolean;
  // F-065: prior COMPLETED notes keyed by bookerId, loaded once on the page.
  histories: Map<string, BookerNoteHistoryEntry[]>;
};

export function AgendaDaySection({ day, isToday, histories }: Props) {
  const count = day.bookings.length;

  return (
    <section
      data-testid="agenda-day"
      data-iso-date={day.isoDate}
      data-count={count}
      className="border-t border-input py-8 first:border-t-0 first:pt-0"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl tracking-tight">
          {formatAgendaDayHeader(day.date)}
          {isToday ? (
            <span className="ml-3 align-middle text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Today
            </span>
          ) : null}
        </h2>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {count === 0 ? "No classes" : `${count} ${count === 1 ? "class" : "classes"}`}
        </p>
      </div>

      {count === 0 ? (
        <p
          data-testid="agenda-day-empty"
          className="mt-4 text-sm text-muted-foreground"
        >
          Nothing scheduled.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-input">
          {day.bookings.map((booking) => (
            <AgendaBookingItem
              key={booking.id}
              booking={booking}
              history={histories.get(booking.bookerId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
