import type { Metadata } from "next";

import { listStudents, type AdminStudentsDeps } from "@/lib/admin/students";
import { prisma } from "@/lib/db";
import { parseAdminStudentsFilters } from "@/lib/schemas/admin-students";

import { Pagination } from "../bookings/_components/pagination";
import { FilterBar } from "./_components/filter-bar";
import { StudentRow } from "./_components/student-row";

function studentsDeps(): AdminStudentsDeps {
  return { prisma };
}

export const metadata: Metadata = {
  title: "Students · Admin",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminStudentsPage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const filters = parseAdminStudentsFilters(rawParams);

  const pageData = await listStudents(studentsDeps(), filters, { now: new Date() });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Students
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          Student directory
        </h1>
        <p className="text-sm text-muted-foreground">
          Everyone who has booked a lesson. Open a profile to see their full
          booking history, the instructors&rsquo; notes, contact details, and
          credit balance.
        </p>
      </header>

      <section className="space-y-6 py-8">
        <FilterBar values={{ q: filters.q }} />

        <div className="overflow-hidden rounded-lg border border-input">
          <div
            className="hidden border-b border-input bg-card/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground sm:grid sm:grid-cols-[1fr,1fr,7rem,8rem,7rem,5rem] sm:gap-3"
            aria-hidden
          >
            <span>Name</span>
            <span>Contact</span>
            <span>Bookings</span>
            <span>Last booking</span>
            <span>Credit</span>
            <span className="text-right">—</span>
          </div>

          {pageData.rows.length === 0 ? (
            <p
              className="px-4 py-12 text-center text-sm text-muted-foreground"
              data-testid="admin-students-empty"
            >
              No students match this search.
            </p>
          ) : (
            <ul data-testid="admin-students-list">
              {pageData.rows.map((row) => (
                <StudentRow key={row.id} row={row} />
              ))}
            </ul>
          )}

          <Pagination
            page={pageData.page}
            totalPages={pageData.totalPages}
            total={pageData.total}
            pageSize={pageData.pageSize}
            searchParams={rawParams}
            basePath="/admin/students"
            idPrefix="admin-students"
            emptyText="No students match this search."
          />
        </div>
      </section>
    </div>
  );
}
