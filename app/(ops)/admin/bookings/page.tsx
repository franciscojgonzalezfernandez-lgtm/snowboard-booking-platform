import type { Metadata } from "next";

import { loadAdminBookings, type AdminBookingsDeps } from "@/lib/admin/bookings";
import { prisma } from "@/lib/db";
import { parseAdminBookingsFilters } from "@/lib/schemas/admin-bookings";

function bookingsDeps(): AdminBookingsDeps {
  return { prisma };
}

import { BookingRow } from "./_components/booking-row";
import { FilterBar } from "./_components/filter-bar";
import { Pagination } from "./_components/pagination";

export const metadata: Metadata = {
  title: "Bookings · Admin",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toIsoDateString(d: Date | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const filters = parseAdminBookingsFilters(rawParams);

  const [instructors, pageData] = await Promise.all([
    prisma.instructor.findMany({
      select: { id: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    loadAdminBookings(bookingsDeps(), filters),
  ]);

  const instructorOptions = instructors.map((i) => ({
    id: i.id,
    name: i.user.name ?? i.user.email,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Bookings
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          All bookings
        </h1>
        <p className="text-sm text-muted-foreground">
          Search and filter every reservation across the season. Open a row to
          see attendees, payment details, and the credit ledger.
        </p>
      </header>

      <section className="space-y-6 py-8">
        <FilterBar
          instructors={instructorOptions}
          values={{
            status: filters.status,
            instructorId: filters.instructorId,
            from: toIsoDateString(filters.from),
            to: toIsoDateString(filters.to),
            q: filters.q,
          }}
        />

        <div className="overflow-hidden rounded-lg border border-input">
          <div
            className="hidden border-b border-input bg-card/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground sm:grid sm:grid-cols-[8.5rem,1fr,1fr,8rem,8rem,5rem] sm:gap-3"
            aria-hidden
          >
            <span>Date · time</span>
            <span>Booker</span>
            <span>Instructor</span>
            <span>Status</span>
            <span>Price</span>
            <span className="text-right">—</span>
          </div>

          {pageData.rows.length === 0 ? (
            <p
              className="px-4 py-12 text-center text-sm text-muted-foreground"
              data-testid="admin-bookings-empty"
            >
              No bookings match these filters.
            </p>
          ) : (
            <ul data-testid="admin-bookings-list">
              {pageData.rows.map((row) => (
                <BookingRow key={row.id} row={row} />
              ))}
            </ul>
          )}

          <Pagination
            page={pageData.page}
            totalPages={pageData.totalPages}
            total={pageData.total}
            pageSize={pageData.pageSize}
            searchParams={rawParams}
          />
        </div>
      </section>
    </div>
  );
}
