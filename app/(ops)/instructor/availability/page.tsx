import type { Metadata } from "next";
import Link from "next/link";

import { requireInstructor } from "@/lib/auth/require-instructor";
import { prisma } from "@/lib/db";
import { startOfUtcDay } from "@/lib/booking-engine/time";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingOverlapsWindow,
} from "@/lib/instructor/availability-block";

import { BlockList } from "./_components/block-list";
import { CreateBlockForm } from "./_components/create-block-form";

export const metadata: Metadata = {
  title: "Availability · Instructor",
};

const TIME_FORMAT = new Intl.DateTimeFormat("en-CH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
const DATE_FORMAT = new Intl.DateTimeFormat("en-CH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function InstructorAvailabilityPage() {
  const { instructorId } = await requireInstructor();

  // Future blocks only — past blocks live on for booking history but the
  // instructor can't act on them. AvailabilityBlock has @@index on
  // (instructorId, startDateTime) so this orders without a sort.
  const now = new Date();
  const blocks = await prisma.availabilityBlock.findMany({
    where: { instructorId, endDateTime: { gt: now } },
    orderBy: { startDateTime: "asc" },
    select: { id: true, startDateTime: true, endDateTime: true, kind: true },
  });

  // Per-block booking flag (F-072): the delete guard rejects any window that
  // overlaps an active booking, so surface that on the row instead of letting
  // the instructor click into a Delete that always fails. MVP scale keeps the
  // active-booking set small; match it against each window with the same
  // overlap rule the server guard uses.
  const firstBlock = blocks[0];
  const activeBookings = firstBlock
    ? await prisma.booking.findMany({
        where: {
          instructorId,
          status: { in: ACTIVE_BOOKING_STATUSES },
          date: { gte: startOfUtcDay(firstBlock.startDateTime) },
        },
        select: { date: true, anchorTime: true, duration: true },
      })
    : [];

  const rows = blocks.map((b) => ({
    id: b.id,
    dateLabel: DATE_FORMAT.format(b.startDateTime),
    startLabel: TIME_FORMAT.format(b.startDateTime),
    endLabel: TIME_FORMAT.format(b.endDateTime),
    hasActiveBooking: activeBookings.some((bk) => bookingOverlapsWindow(bk, b)),
  }));

  return (
    <div
      data-testid="instructor-availability"
      className="mx-auto max-w-3xl px-6 py-12 space-y-10"
    >
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Availability
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          When you can teach
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Add windows when you are available to take bookings. The booking
          calendar on /reservar updates immediately.
        </p>
        <Link
          href="/instructor"
          data-testid="instructor-availability-back"
          className="inline-block text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
        >
          ← Back to agenda
        </Link>
      </header>

      <section
        aria-labelledby="availability-create-heading"
        className="space-y-4"
      >
        <h2
          id="availability-create-heading"
          className="font-display text-2xl tracking-tight"
        >
          New window
        </h2>
        <CreateBlockForm />
      </section>

      <section
        aria-labelledby="availability-list-heading"
        className="space-y-4"
      >
        <h2
          id="availability-list-heading"
          className="font-display text-2xl tracking-tight"
        >
          Upcoming windows
        </h2>
        <BlockList rows={rows} />
      </section>
    </div>
  );
}
