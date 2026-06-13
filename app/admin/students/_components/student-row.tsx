import Link from "next/link";

import { formatAdminDate } from "@/lib/admin/format";
import { LANGUAGE_LABEL } from "@/lib/labels/booking";
import type { AdminStudentRow } from "@/lib/admin/students";
import { formatChf } from "@/lib/pricing/format";

export function StudentRow({ row }: { row: AdminStudentRow }) {
  return (
    <li
      data-testid="admin-student-row"
      data-student-id={row.id}
      className="grid gap-3 border-b border-input px-4 py-4 sm:grid-cols-[1fr,1fr,7rem,8rem,7rem,5rem] sm:items-baseline"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="truncate font-medium" data-testid="admin-student-name">
          {row.name ?? row.email}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {LANGUAGE_LABEL[row.locale]}
        </p>
      </div>

      <div className="min-w-0 space-y-0.5">
        <p
          className="truncate text-sm"
          data-testid="admin-student-email"
        >
          {row.email}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.phone ?? "—"}
        </p>
      </div>

      <div className="text-sm tabular-nums" data-testid="admin-student-bookings-count">
        {row.bookingsCount} booking{row.bookingsCount === 1 ? "" : "s"}
      </div>

      <div className="text-sm tabular-nums">
        {row.lastBookingDate ? formatAdminDate(row.lastBookingDate) : "—"}
      </div>

      <div className="text-sm tabular-nums" data-testid="admin-student-credit">
        {row.activeCreditCents > 0 ? formatChf(row.activeCreditCents) : "—"}
      </div>

      <div className="text-right">
        <Link
          href={`/admin/students/${row.id}`}
          className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          data-testid="admin-student-link"
        >
          Open →
        </Link>
      </div>
    </li>
  );
}
