// EN-only date/time formatters for the admin area (F-077+). Enum-to-label
// maps live in lib/labels/booking.ts (F-086c), shared with /instructor.

// Compact weekday + numeric date for table rows: "Thu, 29 May 2026". UTC
// because Booking.date is @db.Date (UTC midnight).
const ROW_DATE_FORMAT = new Intl.DateTimeFormat("en-CH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatAdminDate(date: Date): string {
  return ROW_DATE_FORMAT.format(date);
}

// Wall-clock time as stored. Anchor times are kept as "HH:MM" strings so we
// pass-through verbatim — no Date math needed.
export function formatAdminTime(anchorTime: string): string {
  return anchorTime;
}

// Long date+time for detail page timestamps. UTC kept implicit; we render the
// instant in Europe/Zurich because operations think in local time.
const DETAIL_DATETIME_FORMAT = new Intl.DateTimeFormat("en-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

export function formatAdminDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return DETAIL_DATETIME_FORMAT.format(d);
}
