import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Current URL search params, used to build prev/next links. */
  searchParams: Record<string, string | string[] | undefined>;
};

function buildHref(
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page") continue;
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const first = value[0];
      if (first !== undefined) params.set(key, first);
    } else {
      params.set(key, value);
    }
  }
  params.set("page", String(page));
  return `/admin/bookings?${params.toString()}`;
}

export function Pagination({ page, totalPages, total, pageSize, searchParams }: Props) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <nav
      data-testid="admin-bookings-pagination"
      className="flex items-center justify-between gap-4 px-4 py-4 text-xs"
    >
      <p
        className="text-muted-foreground"
        data-testid="admin-bookings-pagination-summary"
      >
        {total === 0
          ? "No bookings match these filters."
          : `Showing ${startIdx}–${endIdx} of ${total} · Page ${page} of ${Math.max(totalPages, 1)}`}
      </p>
      <div className="flex items-center gap-3 font-bold uppercase tracking-[0.18em]">
        {hasPrev ? (
          <Link
            href={buildHref(searchParams, page - 1)}
            data-testid="admin-bookings-prev"
            className="underline-offset-4 hover:underline"
          >
            ← Prev
          </Link>
        ) : (
          <span
            data-testid="admin-bookings-prev"
            aria-disabled="true"
            className="text-muted-foreground"
          >
            ← Prev
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(searchParams, page + 1)}
            data-testid="admin-bookings-next"
            className="underline-offset-4 hover:underline"
          >
            Next →
          </Link>
        ) : (
          <span
            data-testid="admin-bookings-next"
            aria-disabled="true"
            className="text-muted-foreground"
          >
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}
