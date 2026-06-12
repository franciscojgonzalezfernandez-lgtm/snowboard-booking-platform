import type {
  BookingStatus,
  CreditReason,
  CreditStatus,
  Duration,
  Level,
  Locale,
} from "@prisma/client";

// Canonical EN labels for the English-only ops surfaces (/admin, /instructor),
// which live outside [locale] and do not use next-intl. The trilingual
// dashboard resolves labels through i18n keys instead
// (app/[locale]/dashboard/_lib/format.ts) — keep these two systems separate.
// Typing each map as Record<Enum, string> makes a new enum member a compile
// error here rather than a silent "undefined" in the UI.

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

export const CREDIT_REASON_LABEL: Record<CreditReason, string> = {
  USER_CANCEL: "User cancelled",
  OPS_CANCEL: "Ops cancelled",
};

export const CREDIT_STATUS_LABEL: Record<CreditStatus, string> = {
  ACTIVE: "Active",
  LOCKED: "Locked",
  USED: "Used",
  EXPIRED: "Expired",
};
