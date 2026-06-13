import type { Metadata } from "next";
import Link from "next/link";

import { MonthCalendar } from "@/components/calendar/month-calendar";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { requireInstructor } from "@/lib/auth/require-instructor";
import { addDays, startOfUtcDay, toIsoDate } from "@/lib/booking-engine/time";
import {
  monthGrid,
  monthIso,
  monthLabel,
  parseMonth,
  shiftMonth,
} from "@/lib/calendar/month-grid";
import { parseWeek, shiftWeek, weekLabel } from "@/lib/calendar/week-grid";
import { getInstructorCalendar } from "@/lib/instructor/calendar-data";
import { prisma } from "@/lib/db";

import {
  blockAvailabilityWindow,
  clearAvailability,
  openAvailabilityRange,
} from "../actions";
import { CalendarConnection } from "./_components/calendar-connection";

export const metadata: Metadata = {
  title: "Calendar · Instructor",
};

// Fallbacks when no active season carries operating hours (the Week axis still
// needs bounds). Matches the F-038 season defaults.
const DEFAULT_HOURS_START = "08:00";
const DEFAULT_HOURS_END = "17:00";

type Props = {
  searchParams: Promise<{
    view?: string;
    month?: string;
    week?: string;
    calendar_connected?: string;
    calendar_error?: string;
  }>;
};

export default async function InstructorCalendarPage({ searchParams }: Props) {
  const { instructorId } = await requireInstructor();
  const {
    view: viewParam,
    month: monthParam,
    week: weekParam,
    calendar_connected: justConnected,
    calendar_error: errorCode,
  } = await searchParams;
  const view = viewParam === "week" ? "week" : "month";
  const now = new Date();
  const todayIso = toIsoDate(startOfUtcDay(now));

  // Resolve the display window for the active view.
  const { year, month } = parseMonth(monthParam, now);
  const { gridStart, gridEnd, monthFirst } = monthGrid(year, month);
  const weekIso = parseWeek(weekParam, now);
  const weekMonday = new Date(`${weekIso}T00:00:00.000Z`);
  const from = view === "week" ? weekMonday : gridStart;
  const to = view === "week" ? addDays(weekMonday, 6) : gridEnd;

  const [days, instructor, season] = await Promise.all([
    getInstructorCalendar({ instructorId, from, to }),
    prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { calendarConnected: true },
    }),
    prisma.season.findFirst({
      where: { active: true },
      select: { operatingHoursStart: true, operatingHoursEnd: true },
    }),
  ]);

  const operatingHoursStart = season?.operatingHoursStart ?? DEFAULT_HOURS_START;
  const operatingHoursEnd = season?.operatingHoursEnd ?? DEFAULT_HOURS_END;

  const navLinkClass =
    "text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline";
  const toggleBase =
    "px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition-colors";

  return (
    <div data-testid="instructor-calendar" className="mx-auto max-w-4xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Calendar
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          {view === "week" ? weekLabel(weekIso) : monthLabel(monthFirst)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Open the days you teach, block time off, and see which days already
          hold classes.
        </p>
      </header>

      {/* Month / Week toggle. */}
      <div
        data-testid="calendar-view-toggle"
        className="mt-6 inline-flex rounded-md border border-input"
      >
        <Link
          href="/instructor/calendar"
          data-testid="calendar-view-month"
          data-active={view === "month"}
          className={`${toggleBase} ${view === "month" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          Month
        </Link>
        <Link
          href="/instructor/calendar?view=week"
          data-testid="calendar-view-week"
          data-active={view === "week"}
          className={`${toggleBase} border-l border-input ${view === "week" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          Week
        </Link>
      </div>

      <nav
        data-testid="calendar-nav"
        className="flex flex-wrap items-center justify-between gap-4 py-6"
      >
        <div className="flex items-center gap-6">
          {view === "week" ? (
            <>
              <Link
                href={`/instructor/calendar?view=week&week=${shiftWeek(weekIso, -1)}`}
                data-testid="calendar-prev"
                className={navLinkClass}
              >
                ← Previous
              </Link>
              <Link
                href="/instructor/calendar?view=week"
                data-testid="calendar-today"
                className={navLinkClass}
              >
                This week
              </Link>
              <Link
                href={`/instructor/calendar?view=week&week=${shiftWeek(weekIso, 1)}`}
                data-testid="calendar-next"
                className={navLinkClass}
              >
                Next →
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/instructor/calendar?month=${shiftMonth(year, month, -1)}`}
                data-testid="calendar-prev"
                className={navLinkClass}
              >
                ← Previous
              </Link>
              <Link
                href="/instructor/calendar"
                data-testid="calendar-today"
                className={navLinkClass}
              >
                This month
              </Link>
              <Link
                href={`/instructor/calendar?month=${shiftMonth(year, month, 1)}`}
                data-testid="calendar-next"
                className={navLinkClass}
              >
                Next →
              </Link>
            </>
          )}
        </div>
        <Link href="/instructor" data-testid="calendar-to-agenda" className={navLinkClass}>
          Agenda view →
        </Link>
      </nav>

      <div className="pb-8">
        <CalendarConnection
          connected={instructor?.calendarConnected ?? false}
          justConnected={justConnected === "1"}
          errorCode={errorCode ?? null}
        />
      </div>

      {view === "week" ? (
        <WeekCalendar
          days={days}
          weekIso={weekIso}
          todayIso={todayIso}
          operatingHoursStart={operatingHoursStart}
          operatingHoursEnd={operatingHoursEnd}
          actions={{ openAvailabilityRange, blockAvailabilityWindow, clearAvailability }}
        />
      ) : (
        <MonthCalendar
          days={days}
          monthIso={monthIso(year, month)}
          todayIso={todayIso}
          actions={{ openAvailabilityRange, blockAvailabilityWindow, clearAvailability }}
        />
      )}
    </div>
  );
}
