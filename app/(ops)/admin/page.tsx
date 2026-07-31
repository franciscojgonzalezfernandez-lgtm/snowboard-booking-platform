import type { Metadata } from "next";
import Link from "next/link";

import { startOfUtcDay, toIsoDate } from "@/lib/booking-engine/time";
import {
  monthGrid,
  monthIso,
  monthLabel,
  parseMonth,
  shiftMonth,
} from "@/lib/calendar/month-grid";
import { prisma } from "@/lib/db";
import {
  getAllInstructorsCalendar,
  getInstructorCalendar,
} from "@/lib/instructor/calendar-data";

import { AdminCalendar, ALL_INSTRUCTORS } from "./_components/admin-calendar";
import { InstructorSelector } from "./_components/instructor-selector";

export const metadata: Metadata = {
  title: "Calendar · Admin",
};

type Props = {
  searchParams: Promise<{ month?: string; instructor?: string }>;
};

export default async function AdminCalendarPage({ searchParams }: Props) {
  const { month: monthParam, instructor: instructorParam } = await searchParams;

  const instructors = await prisma.instructor.findMany({
    where: { active: true },
    select: { id: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const { year, month } = parseMonth(monthParam, now);
  const currentMonthIso = monthIso(year, month);

  if (instructors.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <header className="space-y-3 border-b border-input pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
            Calendar
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            No instructors yet
          </h1>
        </header>
        <p className="py-8 text-sm text-muted-foreground" data-testid="admin-no-instructors">
          Add an instructor to start managing availability.{" "}
          <Link
            href="/admin/instructors"
            className="font-bold underline underline-offset-4"
          >
            Manage instructors →
          </Link>
        </p>
      </div>
    );
  }

  // "All instructors" leads the selector and is the default landing — the
  // admin's bird's-eye view. A specific instructor is opt-in via ?instructor=.
  const options = [
    { id: ALL_INSTRUCTORS, name: "All instructors" },
    ...instructors.map((i) => ({ id: i.id, name: i.user.name ?? i.user.email })),
  ];
  const selectedId =
    options.find((o) => o.id === instructorParam)?.id ?? ALL_INSTRUCTORS;
  const isAll = selectedId === ALL_INSTRUCTORS;

  const { gridStart, gridEnd, monthFirst } = monthGrid(year, month);
  const days = isAll
    ? await getAllInstructorsCalendar({ from: gridStart, to: gridEnd })
    : await getInstructorCalendar({
        instructorId: selectedId,
        from: gridStart,
        to: gridEnd,
      });

  const navLinkClass =
    "text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline";
  const monthHref = (delta: number) =>
    `/admin?instructor=${selectedId}&month=${shiftMonth(year, month, delta)}`;

  return (
    <div data-testid="admin-calendar" className="mx-auto max-w-4xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Calendar
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          {monthLabel(monthFirst)}
        </h1>
        <p className="text-sm text-muted-foreground">
          See every instructor&apos;s classes and edit their availability — open
          days, block time off.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Instructor
          </label>
          <InstructorSelector
            instructors={options}
            selectedId={selectedId}
            month={currentMonthIso}
          />
        </div>
        <nav data-testid="calendar-nav" className="flex items-center gap-6">
          <Link href={monthHref(-1)} data-testid="calendar-prev" className={navLinkClass}>
            ← Previous
          </Link>
          <Link
            href={`/admin?instructor=${selectedId}`}
            data-testid="calendar-today"
            className={navLinkClass}
          >
            This month
          </Link>
          <Link href={monthHref(1)} data-testid="calendar-next" className={navLinkClass}>
            Next →
          </Link>
        </nav>
      </div>

      <AdminCalendar
        days={days}
        monthIso={currentMonthIso}
        todayIso={toIsoDate(startOfUtcDay(now))}
        selected={selectedId}
      />
    </div>
  );
}
