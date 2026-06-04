import type { BookingStatus, Duration, Level, Locale } from "@prisma/client";

// EN-only formatters and labels for the admin area (F-077+). The /admin route
// lives outside [locale]; we copy the small subset rather than importing from
// app/instructor/_lib/labels.ts because lib/ should not depend on app/.

export const DURATION_LABEL: Record<Duration, string> = {
  ONE_HOUR: "1 hour",
  TWO_HOURS: "2 hours",
  INTENSIVE: "Intensive · 4h",
  FULL_DAY: "Full day · 6h",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Pending payment",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED_BY_USER: "Cancelled · client",
  CANCELLED_BY_OPS: "Cancelled · ops",
  CANCELLED_BY_SYSTEM: "Cancelled · system",
  PAYMENT_FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

export const LANGUAGE_LABEL: Record<Locale, string> = {
  en: "English",
  de: "German",
  es: "Spanish",
};

export const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT_FREESTYLE: "Expert · freestyle",
};

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
