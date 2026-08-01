// The /instructor area is English-only and lives outside [locale], so it does
// not use next-intl. Enum-to-label maps live in lib/labels/booking.ts
// (F-086c), shared with /admin.

// Long, weekday-led date for day headers. UTC because Booking.date is @db.Date
// (UTC midnight), mirroring formatBookingDate in the dashboard.
const DAY_HEADER_FORMAT = new Intl.DateTimeFormat("en-CH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function formatAgendaDayHeader(date: Date): string {
  return DAY_HEADER_FORMAT.format(date);
}

// F-065: compact date for booker-history note entries (day · short month ·
// year), so a list of past classes stays scannable. UTC for the same reason as
// the day header — Booking.date is @db.Date.
const HISTORY_DATE_FORMAT = new Intl.DateTimeFormat("en-CH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatBookerHistoryDate(date: Date): string {
  return HISTORY_DATE_FORMAT.format(date);
}
