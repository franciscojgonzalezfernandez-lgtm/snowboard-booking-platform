import type { Metadata } from "next";
import Link from "next/link";

import { MonthCalendar } from "@/components/calendar/month-calendar";
import { requireInstructor } from "@/lib/auth/require-instructor";
import { startOfUtcDay, toIsoDate } from "@/lib/booking-engine/time";
import {
  monthGrid,
  monthIso,
  monthLabel,
  parseMonth,
  shiftMonth,
} from "@/lib/calendar/month-grid";
import { getInstructorCalendar } from "@/lib/instructor/calendar-data";

import {
  blockAvailabilityWindow,
  clearAvailability,
  openAvailabilityRange,
} from "../actions";

export const metadata: Metadata = {
  title: "Calendar · Instructor",
};

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export default async function InstructorCalendarPage({ searchParams }: Props) {
  const { instructorId } = await requireInstructor();
  const { month: monthParam } = await searchParams;
  const now = new Date();
  const { year, month } = parseMonth(monthParam, now);
  const { gridStart, gridEnd, monthFirst } = monthGrid(year, month);

  const days = await getInstructorCalendar({
    instructorId,
    from: gridStart,
    to: gridEnd,
  });

  const navLinkClass =
    "text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline";

  return (
    <div data-testid="instructor-calendar" className="mx-auto max-w-4xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Calendar
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          {monthLabel(monthFirst)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Open the days you teach, block time off, and see which days already
          hold classes.
        </p>
      </header>

      <nav
        data-testid="calendar-nav"
        className="flex flex-wrap items-center justify-between gap-4 py-6"
      >
        <div className="flex items-center gap-6">
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
        </div>
        <Link href="/instructor" data-testid="calendar-to-agenda" className={navLinkClass}>
          Agenda view →
        </Link>
      </nav>

      <MonthCalendar
        days={days}
        monthIso={monthIso(year, month)}
        todayIso={toIsoDate(startOfUtcDay(now))}
        actions={{ openAvailabilityRange, blockAvailabilityWindow, clearAvailability }}
      />
    </div>
  );
}
