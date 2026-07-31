import type { BookingStatus, Duration } from "@prisma/client";

export const INTL_TAG: Record<string, string> = {
  en: "en-CH",
  de: "de-CH",
  es: "es-CH",
};

export const DURATION_LABEL_KEY: Record<Duration, string> = {
  ONE_HOUR: "duration_1h",
  TWO_HOURS: "duration_2h",
  INTENSIVE: "duration_4h",
  FULL_DAY: "duration_6h",
};

export const STATUS_LABEL_KEY: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "status_pending_payment",
  CONFIRMED: "status_confirmed",
  COMPLETED: "status_completed",
  CANCELLED_BY_USER: "status_cancelled_by_user",
  CANCELLED_BY_OPS: "status_cancelled_by_ops",
  CANCELLED_BY_SYSTEM: "status_cancelled_by_system",
  PAYMENT_FAILED: "status_payment_failed",
  REFUNDED: "status_refunded",
};

export function formatBookingDate(date: Date, locale: string): string {
  const tag = INTL_TAG[locale] ?? "en-CH";
  return new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatShortDate(date: Date, locale: string): string {
  const tag = INTL_TAG[locale] ?? "en-CH";
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
