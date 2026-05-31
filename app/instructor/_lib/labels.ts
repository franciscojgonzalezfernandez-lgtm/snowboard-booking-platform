import type { BookingStatus, Duration, Locale } from "@prisma/client";

// The /instructor area is English-only and lives outside [locale], so it does
// not use next-intl. These are the canonical EN labels for that area.

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
