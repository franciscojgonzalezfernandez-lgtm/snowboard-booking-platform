import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Server-rendered <form method="get"> — no JS island, same pattern as the
// bookings filter bar (F-077). The directory only filters by a free-text
// search over booker name/email, so this is a single field. A hidden `page=1`
// resets pagination whenever the search changes.

type Props = {
  values: {
    q: string | undefined;
  };
};

export function FilterBar({ values }: Props) {
  return (
    <form
      method="get"
      data-testid="admin-students-filters"
      className="grid gap-3 rounded-lg border border-input bg-card p-4 sm:grid-cols-[1fr,8rem] sm:items-end"
    >
      <input type="hidden" name="page" value="1" />

      <div className="space-y-1.5">
        <label
          htmlFor="filter-q"
          className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
        >
          Search student
        </label>
        <Input
          id="filter-q"
          name="q"
          type="search"
          placeholder="Name or email"
          defaultValue={values.q ?? ""}
          data-testid="admin-students-q"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" data-testid="admin-students-submit">
          Search
        </Button>
        <Link
          href="/admin/students"
          className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          data-testid="admin-students-reset"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
