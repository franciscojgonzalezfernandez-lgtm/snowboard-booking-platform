"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatHHMM, parseHHMM } from "@/lib/booking-engine/time";
import {
  hourRows,
  layoutInterval,
  ratioToTime,
  weekDays,
} from "@/lib/calendar/week-grid";
import type { InstructorCalendarDay } from "@/lib/instructor/availability";
import type { AvailabilityActionError } from "@/lib/instructor/availability-actions";

import { AVAILABILITY_ERROR_COPY as ERROR_COPY } from "./availability-errors";
import type { CalendarActions } from "./month-calendar";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** Pixel height of the timeline body; percentages from `layoutInterval` map onto it. */
const TIMELINE_HEIGHT = 600;

type Props = {
  /** Exactly the seven Mon→Sun days of the focused week. */
  days: InstructorCalendarDay[];
  weekIso: string;
  todayIso: string;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  actions: CalendarActions;
};

/** Create a BLOCKED window (drag or "Block…" button) — or null when closed. */
type BlockConfirm = { kind: "block"; date: string };
/** Delete an AVAILABLE (close day) or BLOCKED (unblock) block. */
type ClearConfirm = {
  kind: "clear";
  blockId: string;
  title: string;
  body: string;
  confirmLabel: string;
};
type Confirm = BlockConfirm | ClearConfirm | null;

type DragState = { date: string; startRatio: number; currentRatio: number };

function shortWeekday(index: number): string {
  return WEEKDAY_LABELS[index] ?? "";
}

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

/** Advance an HH:MM by `deltaMin`, clamped to `ceilHHMM`. */
function addClamped(hhmm: string, deltaMin: number, ceilHHMM: string): string {
  return formatHHMM(Math.min(parseHHMM(hhmm) + deltaMin, parseHHMM(ceilHHMM)));
}

export function WeekCalendar({
  days,
  weekIso,
  todayIso,
  operatingHoursStart,
  operatingHoursEnd,
  actions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [blockStart, setBlockStart] = useState(operatingHoursStart);
  const [blockEnd, setBlockEnd] = useState(
    addClamped(operatingHoursStart, 120, operatingHoursEnd),
  );
  const dragMoved = useRef(false);

  const rows = hourRows(operatingHoursStart, operatingHoursEnd);
  const orderedIso = weekDays(weekIso);
  const byIso = new Map(days.map((d) => [d.isoDate, d]));

  function run(
    action: () => Promise<{ ok: boolean; error?: AvailabilityActionError }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok && result.error) {
        setError(ERROR_COPY[result.error]);
        return;
      }
      setConfirm(null);
      router.refresh();
    });
  }

  function openBlockDialog(date: string, start: string, end: string) {
    setBlockStart(start);
    setBlockEnd(end);
    setError(null);
    setConfirm({ kind: "block", date });
  }

  // --- Drag-select on an open day's timeline → pre-fills the block dialog. ---
  function ratioFromEvent(
    e: React.PointerEvent<HTMLDivElement>,
    el: HTMLDivElement,
  ): number {
    const rect = el.getBoundingClientRect();
    return (e.clientY - rect.top) / rect.height;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, date: string) {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const ratio = ratioFromEvent(e, el);
    dragMoved.current = false;
    setDrag({ date, startRatio: ratio, currentRatio: ratio });
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    dragMoved.current = true;
    const ratio = ratioFromEvent(e, e.currentTarget);
    setDrag((d) => (d ? { ...d, currentRatio: ratio } : null));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>, date: string) {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const lo = Math.min(drag.startRatio, drag.currentRatio);
    const hi = Math.max(drag.startRatio, drag.currentRatio);
    setDrag(null);
    let start = ratioToTime(lo, operatingHoursStart, operatingHoursEnd);
    let end = ratioToTime(hi, operatingHoursStart, operatingHoursEnd);
    // A click (no real drag) seeds a default 1h window from the clicked time.
    if (!dragMoved.current || start === end) {
      end = addClamped(start, 60, operatingHoursEnd);
      if (start === end) start = addClamped(end, -60, operatingHoursStart);
    }
    openBlockDialog(date, start, end);
  }

  return (
    <section className="space-y-6" data-testid="week-calendar">
      {error ? (
        <p data-testid="calendar-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Drag on an open day to block a window, or use the per-day controls.
        Operating hours {operatingHoursStart}–{operatingHoursEnd}.
      </p>

      {/* Day headers. */}
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-px">
        <div aria-hidden />
        {orderedIso.map((iso, i) => {
          const day = byIso.get(iso);
          const isToday = iso === todayIso;
          const hasBookings = (day?.bookings.length ?? 0) > 0;
          return (
            <div
              key={iso}
              data-testid={`week-day-header-${iso}`}
              className="flex flex-col items-center gap-1 pb-2 text-center"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {shortWeekday(i)}
              </span>
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center text-sm",
                  isToday && "rounded-full bg-foreground font-bold text-background",
                )}
              >
                {dayNumber(iso)}
              </span>
              {day && !hasBookings && day.open ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`week-block-${iso}`}
                  disabled={pending}
                  onClick={() =>
                    openBlockDialog(
                      iso,
                      operatingHoursStart,
                      addClamped(operatingHoursStart, 120, operatingHoursEnd),
                    )
                  }
                  className="h-auto px-1 py-0 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  + Block
                </Button>
              ) : day && !hasBookings && !day.open ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`week-open-${iso}`}
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      actions.openAvailabilityRange({ fromDate: iso, toDate: iso }),
                    )
                  }
                  className="h-auto px-1 py-0 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Open
                </Button>
              ) : hasBookings ? (
                <span
                  data-testid={`week-locked-${iso}`}
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {day!.bookings.length} booked
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Timeline body: hour gutter + seven day columns. */}
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-px">
        {/* Hour labels gutter. */}
        <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
          {rows.map((r) => (
            <span
              key={r.label}
              className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: `${r.topPct}%` }}
            >
              {r.label}
            </span>
          ))}
        </div>

        {orderedIso.map((iso) => {
          const day = byIso.get(iso);
          const open = day?.open ?? false;
          const hasBookings = (day?.bookings.length ?? 0) > 0;
          const interactive = open && !hasBookings;
          const isDragging = drag?.date === iso;
          return (
            <div
              key={iso}
              data-testid={`week-day-col-${iso}`}
              data-open={open}
              data-has-bookings={hasBookings}
              className={cn(
                "relative border-l border-input",
                open ? "bg-secondary/20" : "bg-muted/40",
                interactive && "cursor-row-resize touch-none",
              )}
              style={{ height: TIMELINE_HEIGHT }}
              onPointerDown={
                interactive ? (e) => onPointerDown(e, iso) : undefined
              }
              onPointerMove={interactive ? onPointerMove : undefined}
              onPointerUp={interactive ? (e) => onPointerUp(e, iso) : undefined}
            >
              {/* Hour gridlines. */}
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="pointer-events-none absolute inset-x-0 border-t border-input/50"
                  style={{ top: `${r.topPct}%` }}
                />
              ))}

              {/* Blocked windows. */}
              {(day?.blocked ?? []).map((b) => {
                const layout = layoutInterval(
                  b.start,
                  b.end,
                  operatingHoursStart,
                  operatingHoursEnd,
                );
                if (!layout) return null;
                return (
                  <button
                    key={b.id}
                    type="button"
                    data-testid={`week-blocked-${b.id}`}
                    disabled={pending}
                    // Stop the column's drag-select from capturing this pointer,
                    // otherwise the click never lands on the button.
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() =>
                      setConfirm({
                        kind: "clear",
                        blockId: b.id,
                        title: "Remove blocked window?",
                        body: `${b.start}–${b.end} on ${longDate(iso)} will reopen for bookings.`,
                        confirmLabel: "Remove block",
                      })
                    }
                    className="absolute inset-x-1 z-10 flex items-start justify-between gap-1 overflow-hidden rounded-sm border border-destructive/40 bg-destructive/15 px-1.5 py-1 text-left text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/25"
                    style={{ top: `${layout.topPct}%`, height: `${layout.heightPct}%` }}
                  >
                    <span className="tabular-nums">
                      {b.start}–{b.end}
                    </span>
                    <span aria-hidden>×</span>
                  </button>
                );
              })}

              {/* Bookings (read-only). */}
              {(day?.bookings ?? []).map((b) => {
                const layout = layoutInterval(
                  b.anchorTime,
                  b.endTime,
                  operatingHoursStart,
                  operatingHoursEnd,
                );
                if (!layout) return null;
                return (
                  <div
                    key={b.id}
                    data-testid={`week-booking-${b.id}`}
                    className="absolute inset-x-1 z-20 overflow-hidden rounded-sm bg-foreground px-1.5 py-1 text-[10px] font-medium text-background"
                    style={{ top: `${layout.topPct}%`, height: `${layout.heightPct}%` }}
                  >
                    <span className="block tabular-nums">
                      {b.anchorTime}–{b.endTime}
                    </span>
                    <span className="block truncate text-background/70">
                      {b.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                );
              })}

              {/* Live drag selection. */}
              {isDragging ? (
                <div
                  data-testid="week-drag-selection"
                  className="pointer-events-none absolute inset-x-1 z-30 rounded-sm border-2 border-dashed border-foreground/60 bg-foreground/10"
                  style={{
                    top: `${Math.min(drag.startRatio, drag.currentRatio) * 100}%`,
                    height: `${Math.abs(drag.currentRatio - drag.startRatio) * 100}%`,
                  }}
                />
              ) : null}

              {/* Close day (only when open, no bookings). */}
              {interactive && day?.openBlockId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`week-close-${iso}`}
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirm({
                      kind: "clear",
                      blockId: day.openBlockId!,
                      title: "Close this day?",
                      body: `${longDate(iso)} will no longer accept bookings.`,
                      confirmLabel: "Close day",
                    });
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-x-1 bottom-1 z-40 h-auto py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
                >
                  Close
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Confirm / block dialog. */}
      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        {confirm?.kind === "block" ? (
          <DialogContent data-testid="week-block-dialog">
            <DialogHeader>
              <DialogTitle>Block time on {longDate(confirm.date)}</DialogTitle>
              <DialogDescription>
                The window stays within operating hours and won&apos;t be
                bookable.
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  actions.blockAvailabilityWindow({
                    date: confirm.date,
                    startTime: blockStart,
                    endTime: blockEnd,
                  }),
                );
              }}
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  From
                </label>
                <Input
                  type="time"
                  data-testid="week-block-start"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  To
                </label>
                <Input
                  type="time"
                  data-testid="week-block-end"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button
                type="submit"
                data-testid="week-block-confirm"
                disabled={pending}
              >
                Block window
              </Button>
            </form>
          </DialogContent>
        ) : confirm?.kind === "clear" ? (
          <DialogContent data-testid="week-clear-dialog">
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.body}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" data-testid="week-clear-cancel" />}
              >
                Cancel
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                data-testid="week-clear-confirm"
                disabled={pending}
                onClick={() =>
                  run(() => actions.clearAvailability({ blockId: confirm.blockId }))
                }
              >
                {confirm.confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
