import type { Metadata } from "next";
import Link from "next/link";

import { requireInstructor } from "@/lib/auth/require-instructor";
import { addDays, startOfUtcDay, toIsoDate } from "@/lib/booking-engine/time";
import { getInstructorCalendar } from "@/lib/instructor/calendar-data";

import { MonthCalendar } from "./_components/month-calendar";

export const metadata: Metadata = {
  title: "Calendar · Instructor",
};

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseMonth(
  raw: string | undefined,
  now: Date,
): { year: number; month: number } {
  if (raw && MONTH_RE.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(5, 7));
    if (month >= 1 && month <= 12) return { year, month };
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function monthIso(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthIso(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export default async function InstructorCalendarPage({ searchParams }: Props) {
  const { instructorId } = await requireInstructor();
  const { month: monthParam } = await searchParams;
  const now = new Date();
  const { year, month } = parseMonth(monthParam, now);

  // Pad the month to whole Monday-start weeks so the grid is rectangular.
  const monthFirst = startOfUtcDay(new Date(Date.UTC(year, month - 1, 1)));
  const monthLast = startOfUtcDay(new Date(Date.UTC(year, month, 0)));
  const firstWeekday = (monthFirst.getUTCDay() + 6) % 7;
  const lastWeekday = (monthLast.getUTCDay() + 6) % 7;
  const gridStart = addDays(monthFirst, -firstWeekday);
  const gridEnd = addDays(monthLast, 6 - lastWeekday);

  const days = await getInstructorCalendar({
    instructorId,
    from: gridStart,
    to: gridEnd,
  });

  const monthLabel = new Intl.DateTimeFormat("en-CH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthFirst);

  const navLinkClass =
    "text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline";

  return (
    <div data-testid="instructor-calendar" className="mx-auto max-w-4xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Calendar
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          {monthLabel}
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
      />
    </div>
  );
}
