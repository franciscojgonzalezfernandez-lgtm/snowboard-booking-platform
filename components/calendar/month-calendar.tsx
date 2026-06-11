"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InstructorCalendarDay } from "@/lib/instructor/availability";
import type {
  AvailabilityActionError,
  BlockWindowResult,
  ClearResult,
  OpenRangeResult,
} from "@/lib/instructor/availability-actions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const ERROR_COPY: Record<AvailabilityActionError, string> = {
  INVALID_INPUT: "Check the dates and times, then try again.",
  NO_ACTIVE_SEASON: "No active season — set one up first.",
  RANGE_TOO_LONG: "That range is too long. Open at most a quarter at a time.",
  OUT_OF_HOURS: "That window falls outside the season's operating hours.",
  INVALID_RANGE: "The end must come after the start.",
  HAS_BOOKINGS: "This day has booked classes. Cancel them from the admin panel first.",
  NOT_FOUND: "That block no longer exists. Refreshing.",
  FORBIDDEN: "You can only edit this instructor's availability.",
};

/**
 * Availability mutations the calendar drives, injected by the host route. The
 * instructor page (`/instructor/calendar`) binds the session instructor; the
 * admin page (`/admin`) binds the selected instructor. Keeping these as props
 * decouples the grid from any one `actions.ts`.
 */
export type CalendarActions = {
  openAvailabilityRange(input: {
    fromDate: string;
    toDate: string;
  }): Promise<OpenRangeResult>;
  blockAvailabilityWindow(input: {
    date: string;
    startTime: string;
    endTime: string;
  }): Promise<BlockWindowResult>;
  clearAvailability(input: { blockId: string }): Promise<ClearResult>;
  /** All-mode close: clears every active instructor's block on the day. */
  closeDay?(input: { date: string }): Promise<ClearResult>;
};

/**
 * "single" edits one instructor by block id; "all" edits every active
 * instructor by date (close is day-based, sub-day block windows are hidden
 * since they only make sense per instructor).
 */
export type CalendarMode = "single" | "all";

function dayNumber(iso: string): number {
  return Number(iso.slice(8, 10));
}

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

type Props = {
  days: InstructorCalendarDay[];
  /** "YYYY-MM" of the focused month — out-of-month grid cells render dimmed. */
  monthIso: string;
  todayIso: string;
  actions: CalendarActions;
  mode?: CalendarMode;
};

export function MonthCalendar({
  days,
  monthIso,
  todayIso,
  actions,
  mode = "single",
}: Props) {
  const isAll = mode === "all";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [blockStart, setBlockStart] = useState("10:00");
  const [blockEnd, setBlockEnd] = useState("12:00");

  const selected = days.find((d) => d.isoDate === selectedIso) ?? null;

  function run(action: () => Promise<{ ok: boolean; error?: AvailabilityActionError }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok && result.error) {
        setError(ERROR_COPY[result.error]);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-8">
      {/* Open a whole range in one go. */}
      <form
        data-testid="open-range-form"
        className="flex flex-wrap items-end gap-3 rounded-md border border-input p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rangeFrom || !rangeTo) return;
          run(() => actions.openAvailabilityRange({ fromDate: rangeFrom, toDate: rangeTo }));
        }}
      >
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Open from
          </label>
          <Input
            type="date"
            data-testid="open-range-from"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            to
          </label>
          <Input
            type="date"
            data-testid="open-range-to"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="w-44"
          />
        </div>
        <Button type="submit" data-testid="open-range-submit" disabled={pending}>
          Open range
        </Button>
      </form>

      {error ? (
        <p
          data-testid="calendar-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {/* Month grid. */}
      <div>
        <div className="grid grid-cols-7 border-b border-input pb-2">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day.isoDate.slice(0, 7) === monthIso;
            const isToday = day.isoDate === todayIso;
            const hasBookings = day.bookings.length > 0;
            const isSelected = day.isoDate === selectedIso;
            return (
              <button
                key={day.isoDate}
                type="button"
                data-testid={`calendar-day-${day.isoDate}`}
                data-open={day.open}
                data-has-bookings={hasBookings}
                disabled={!inMonth}
                onClick={() => {
                  setSelectedIso(day.isoDate);
                  setError(null);
                }}
                className={cn(
                  "flex min-h-20 flex-col items-start gap-1 border-b border-r border-input p-2 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !inMonth && "pointer-events-none opacity-30",
                  inMonth && "hover:bg-foreground/[0.03]",
                  day.open && !hasBookings && "bg-secondary/40",
                  hasBookings && "bg-foreground/[0.05]",
                  isSelected && "ring-2 ring-foreground ring-inset",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center text-sm",
                    isToday &&
                      "rounded-full bg-foreground font-bold text-background",
                  )}
                >
                  {dayNumber(day.isoDate)}
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  {hasBookings ? (
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
                      {day.bookings.length}{" "}
                      {day.bookings.length === 1 ? "class" : "classes"}
                    </span>
                  ) : day.open ? (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Open
                    </span>
                  ) : null}
                  {day.blocked.length > 0 ? (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-destructive">
                      {day.blocked.length} blocked
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail + actions. */}
      {selected ? (
        <div
          data-testid="day-panel"
          data-iso={selected.isoDate}
          className="space-y-5 rounded-md border border-input p-6"
        >
          <p className="font-display text-2xl tracking-tight">
            {longDate(selected.isoDate)}
          </p>

          {selected.bookings.length > 0 ? (
            <div className="space-y-2" data-testid="day-bookings">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Booked classes
              </p>
              <ul className="space-y-1 text-sm">
                {selected.bookings.map((b) => (
                  <li key={b.id} className="tabular-nums">
                    {b.anchorTime}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {b.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Locked: this day holds classes. To cancel them, use the admin
                cancel-day flow.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                {selected.open ? (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="close-day"
                    disabled={pending || (!isAll && !selected.openBlockId)}
                    onClick={() => {
                      if (isAll) {
                        run(() => actions.closeDay!({ date: selected.isoDate }));
                      } else if (selected.openBlockId) {
                        run(() =>
                          actions.clearAvailability({
                            blockId: selected.openBlockId!,
                          }),
                        );
                      }
                    }}
                  >
                    Close day
                  </Button>
                ) : (
                  <Button
                    type="button"
                    data-testid="open-day"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        actions.openAvailabilityRange({
                          fromDate: selected.isoDate,
                          toDate: selected.isoDate,
                        }),
                      )
                    }
                  >
                    Open day
                  </Button>
                )}
              </div>

              {!isAll && selected.open ? (
                <form
                  data-testid="block-window-form"
                  className="flex flex-wrap items-end gap-3 border-t border-input pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() =>
                      actions.blockAvailabilityWindow({
                        date: selected.isoDate,
                        startTime: blockStart,
                        endTime: blockEnd,
                      }),
                    );
                  }}
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Block from
                    </label>
                    <Input
                      type="time"
                      data-testid="block-start"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      to
                    </label>
                    <Input
                      type="time"
                      data-testid="block-end"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    data-testid="block-submit"
                    disabled={pending}
                  >
                    Block window
                  </Button>
                </form>
              ) : null}

              {!isAll && selected.blocked.length > 0 ? (
                <div className="space-y-2 border-t border-input pt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Blocked windows
                  </p>
                  <ul className="space-y-2">
                    {selected.blocked.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-4 text-sm tabular-nums"
                      >
                        <span>
                          {b.start} – {b.end}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`unblock-${b.id}`}
                          disabled={pending}
                          onClick={() => run(() => actions.clearAvailability({ blockId: b.id }))}
                          className="h-auto px-0 text-xs uppercase tracking-wider text-muted-foreground hover:bg-transparent hover:text-destructive hover:underline"
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
