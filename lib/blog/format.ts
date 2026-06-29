import type { Locale } from "@/i18n/routing";

/** BCP-47 tag per locale for date lines on blog surfaces. */
const INTL_TAG: Record<Locale, string> = {
  en: "en-CH",
  de: "de-CH",
  es: "es-CH",
};

/** Long, localized publish date (e.g. "20 June 2026"). Dates are date-only
 * (no time), so format in UTC to avoid a timezone day-shift. */
export function formatBlogDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
