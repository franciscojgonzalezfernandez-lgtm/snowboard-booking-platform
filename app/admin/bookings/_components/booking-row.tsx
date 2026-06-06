import Link from "next/link";

import {
  DURATION_LABEL,
  STATUS_LABEL,
  formatAdminDate,
  formatAdminTime,
} from "@/lib/admin/format";
import type { AdminBookingRow } from "@/lib/admin/bookings";
import { formatChf } from "@/lib/pricing/format";

export function BookingRow({ row }: { row: AdminBookingRow }) {
  return (
    <li
      data-testid="admin-booking-row"
      data-booking-id={row.id}
      data-status={row.status}
      className="grid gap-3 border-b border-input px-4 py-4 sm:grid-cols-[8.5rem,1fr,1fr,8rem,8rem,5rem] sm:items-baseline"
    >
      <div className="font-display text-base tracking-tight tabular-nums">
        <p>{formatAdminDate(row.date)}</p>
        <p className="text-xs text-muted-foreground">
          {formatAdminTime(row.anchorTime)} · {DURATION_LABEL[row.duration]}
        </p>
      </div>

      <div className="min-w-0 space-y-0.5">
        <p
          className="truncate font-medium"
          data-testid="admin-booking-booker-name"
        >
          {row.booker.name ?? row.booker.email}
        </p>
        <p
          className="truncate text-xs text-muted-foreground"
          data-testid="admin-booking-booker-email"
        >
          {row.booker.email}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm">{row.instructor.user.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {row.attendees.length} attendee{row.attendees.length === 1 ? "" : "s"}
        </p>
      </div>

      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
          data-testid="admin-booking-status-label"
        >
          {STATUS_LABEL[row.status]}
        </p>
      </div>

      <div className="text-sm tabular-nums">
        <p data-testid="admin-booking-total">{formatChf(row.totalPriceCents)}</p>
        {row.creditsAppliedCents && row.creditsAppliedCents > 0 ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid="admin-booking-credits"
          >
            −{formatChf(row.creditsAppliedCents)} credit
          </p>
        ) : null}
      </div>

      <div className="text-right">
        <Link
          href={`/admin/bookings/${row.id}`}
          className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          data-testid="admin-booking-link"
        >
          Open →
        </Link>
      </div>
    </li>
  );
}
