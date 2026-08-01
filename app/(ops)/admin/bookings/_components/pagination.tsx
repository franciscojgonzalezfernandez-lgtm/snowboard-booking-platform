import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Current URL search params, used to build prev/next links. */
  searchParams: Record<string, string | string[] | undefined>;
  /**
   * Route the prev/next links point at. Defaults to the bookings list so the
   * existing call site stays unchanged; the student directory (F-087) reuses
   * this component with its own path. `idPrefix` / `emptyText` likewise default
   * to the bookings copy.
   */
  basePath?: string;
  idPrefix?: string;
  emptyText?: string;
};

function buildHref(
  basePath: string,
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
  return `${basePath}?${params.toString()}`;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  searchParams,
  basePath = "/admin/bookings",
  idPrefix = "admin-bookings",
  emptyText = "No bookings match these filters.",
}: Props) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <nav
      data-testid={`${idPrefix}-pagination`}
      className="flex items-center justify-between gap-4 px-4 py-4 text-xs"
    >
      <p
        className="text-muted-foreground"
        data-testid={`${idPrefix}-pagination-summary`}
      >
        {total === 0
          ? emptyText
          : `Showing ${startIdx}–${endIdx} of ${total} · Page ${page} of ${Math.max(totalPages, 1)}`}
      </p>
      <div className="flex items-center gap-3 font-bold uppercase tracking-[0.18em]">
        {hasPrev ? (
          <Link
            href={buildHref(basePath, searchParams, page - 1)}
            data-testid={`${idPrefix}-prev`}
            className="underline-offset-4 hover:underline"
          >
            ← Prev
          </Link>
        ) : (
          <span
            data-testid={`${idPrefix}-prev`}
            aria-disabled="true"
            className="text-muted-foreground"
          >
            ← Prev
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(basePath, searchParams, page + 1)}
            data-testid={`${idPrefix}-next`}
            className="underline-offset-4 hover:underline"
          >
            Next →
          </Link>
        ) : (
          <span
            data-testid={`${idPrefix}-next`}
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
