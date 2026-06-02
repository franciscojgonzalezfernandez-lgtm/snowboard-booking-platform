import type { Metadata } from "next";
import Link from "next/link";

import { requireInstructor } from "@/lib/auth/require-instructor";
import { addDays, startOfUtcDay, toIsoDate } from "@/lib/booking-engine/time";

import { AGENDA_WINDOW_DAYS, getInstructorAgenda } from "@/lib/instructor/agenda";

import { AgendaDaySection } from "./_components/agenda-day";

export const metadata: Metadata = {
  title: "Agenda · Instructor",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parse a `?from=YYYY-MM-DD` param into a UTC-midnight day, rejecting malformed
// or impossible dates (e.g. 2026-02-31, which would otherwise roll over).
function parseFrom(raw: string | undefined): Date | null {
  if (!raw || !ISO_DATE_RE.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(5, 7));
  const day = Number(raw.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

const RANGE_FORMAT = new Intl.DateTimeFormat("en-CH", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

type Props = {
  searchParams: Promise<{ from?: string; cancelled?: string }>;
};

export default async function InstructorAgendaPage({ searchParams }: Props) {
  const { instructorId } = await requireInstructor();
  const { from: fromParam, cancelled } = await searchParams;

  const now = new Date();
  const todayDay = startOfUtcDay(now);
  const todayIso = toIsoDate(todayDay);
  const fromDay = parseFrom(fromParam) ?? todayDay;
  const includeCancelled = cancelled === "1";

  const days = await getInstructorAgenda({
    instructorId,
    from: fromDay,
    includeCancelled,
  });

  const fromIso = toIsoDate(fromDay);
  const prevIso = toIsoDate(addDays(fromDay, -AGENDA_WINDOW_DAYS));
  const nextIso = toIsoDate(addDays(fromDay, AGENDA_WINDOW_DAYS));
  const lastDay = addDays(fromDay, AGENDA_WINDOW_DAYS - 1);
  const cancelledSuffix = includeCancelled ? "&cancelled=1" : "";

  const totalClasses = days.reduce((sum, day) => sum + day.bookings.length, 0);

  const navLinkClass =
    "text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline";

  return (
    <div data-testid="instructor-agenda" className="mx-auto max-w-3xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Agenda
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          {RANGE_FORMAT.format(fromDay)} – {RANGE_FORMAT.format(lastDay)}
        </h1>
        <p
          data-testid="agenda-total"
          className="text-sm text-muted-foreground"
        >
          {totalClasses === 0
            ? "No classes in this window."
            : `${totalClasses} ${totalClasses === 1 ? "class" : "classes"} scheduled.`}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link
            href="/instructor/availability"
            data-testid="agenda-manage-availability"
            className="inline-block text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          >
            Manage availability →
          </Link>
          <Link
            href="/instructor/profile"
            data-testid="agenda-edit-profile"
            className="inline-block text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          >
            Edit profile →
          </Link>
        </div>
      </header>

      <nav
        data-testid="agenda-nav"
        className="flex flex-wrap items-center justify-between gap-4 py-6"
      >
        <div className="flex items-center gap-6">
          <Link
            href={`/instructor?from=${prevIso}${cancelledSuffix}`}
            data-testid="agenda-prev"
            className={navLinkClass}
          >
            ← Previous
          </Link>
          <Link
            href={includeCancelled ? "/instructor?cancelled=1" : "/instructor"}
            data-testid="agenda-today"
            className={navLinkClass}
          >
            Today
          </Link>
          <Link
            href={`/instructor?from=${nextIso}${cancelledSuffix}`}
            data-testid="agenda-next"
            className={navLinkClass}
          >
            Next →
          </Link>
        </div>
        <Link
          href={
            includeCancelled
              ? `/instructor?from=${fromIso}`
              : `/instructor?from=${fromIso}&cancelled=1`
          }
          data-testid="agenda-toggle-cancelled"
          data-active={includeCancelled}
          className={navLinkClass}
        >
          {includeCancelled ? "Hide cancelled" : "Show cancelled"}
        </Link>
      </nav>

      <div>
        {days.map((day) => (
          <AgendaDaySection
            key={day.isoDate}
            day={day}
            isToday={day.isoDate === todayIso}
          />
        ))}
      </div>
    </div>
  );
}
