import Link from "next/link";

import { BookingStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL } from "@/lib/admin/format";

// Server-rendered <form method="get"> — no JS island. Filtering submits the
// form, which lets the page re-parse searchParams and render the new view.
// A hidden `page=1` resets pagination whenever filters change so users don't
// land on an out-of-range page after narrowing.

type InstructorOption = { id: string; name: string };

type Props = {
  instructors: InstructorOption[];
  values: {
    status: BookingStatus | undefined;
    instructorId: string | undefined;
    from: string | undefined;
    to: string | undefined;
    q: string | undefined;
  };
};

const STATUSES = Object.values(BookingStatus);

export function FilterBar({ instructors, values }: Props) {
  return (
    <form
      method="get"
      data-testid="admin-bookings-filters"
      className="grid gap-3 rounded-lg border border-input bg-card p-4 sm:grid-cols-[1fr,1fr,9rem,9rem,8rem] sm:items-end"
    >
      <input type="hidden" name="page" value="1" />

      <div className="space-y-1.5">
        <label
          htmlFor="filter-q"
          className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
        >
          Search booker
        </label>
        <Input
          id="filter-q"
          name="q"
          type="search"
          placeholder="Name or email"
          defaultValue={values.q ?? ""}
          data-testid="admin-bookings-q"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="filter-instructor"
          className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
        >
          Instructor
        </label>
        <select
          id="filter-instructor"
          name="instructorId"
          defaultValue={values.instructorId ?? ""}
          data-testid="admin-bookings-instructor"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="filter-status"
          className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
        >
          Status
        </label>
        <select
          id="filter-status"
          name="status"
          defaultValue={values.status ?? ""}
          data-testid="admin-bookings-status"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="filter-from"
          className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
        >
          From
        </label>
        <Input
          id="filter-from"
          name="from"
          type="date"
          defaultValue={values.from ?? ""}
          data-testid="admin-bookings-from"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="filter-to"
          className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
        >
          To
        </label>
        <Input
          id="filter-to"
          name="to"
          type="date"
          defaultValue={values.to ?? ""}
          data-testid="admin-bookings-to"
        />
      </div>

      <div className="sm:col-span-5 flex items-center gap-3">
        <Button type="submit" data-testid="admin-bookings-submit">
          Apply
        </Button>
        <Link
          href="/admin/bookings"
          className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          data-testid="admin-bookings-reset"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
