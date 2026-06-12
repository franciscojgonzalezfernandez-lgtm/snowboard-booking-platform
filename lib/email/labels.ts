import type { Duration, Locale } from "@prisma/client";

// Locale-aware labels shared by the transactional email senders (confirmed,
// reminder, cancellation). Email wording differs on purpose from the ops-UI
// maps in lib/labels/booking.ts ("4 hours · intensive" vs "Intensive · 4h"),
// so the two sources are deliberately separate.

export const DURATION_LABELS: Record<Locale, Record<Duration, string>> = {
  en: {
    ONE_HOUR: "1 hour",
    TWO_HOURS: "2 hours",
    INTENSIVE: "4 hours · intensive",
    FULL_DAY: "6 hours · full day",
  },
  de: {
    ONE_HOUR: "1 Stunde",
    TWO_HOURS: "2 Stunden",
    INTENSIVE: "4 Stunden · Intensiv",
    FULL_DAY: "6 Stunden · Ganztags",
  },
  es: {
    ONE_HOUR: "1 hora",
    TWO_HOURS: "2 horas",
    INTENSIVE: "4 horas · intensivo",
    FULL_DAY: "6 horas · jornada completa",
  },
};

/** BCP-47 tag per email locale for Intl.DateTimeFormat date lines. */
export const INTL_TAG: Record<Locale, string> = {
  en: "en-CH",
  de: "de-CH",
  es: "es-CH",
};
