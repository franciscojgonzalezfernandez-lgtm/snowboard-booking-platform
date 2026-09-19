import { Duration } from "@prisma/client";

// F-145 — live price interpolation for answer-posts. The price answer-post must
// never hardcode CHF numbers in MDX (they'd go stale when an admin edits prices,
// F-144). Instead the copy carries {{TOKEN}} placeholders that the blog page
// fills at render from the active season (getActiveSeasonPrices), so the visible
// text, the meta description and the FAQPage/BlogPosting JSON-LD all stay live.

/** Seeded season 2026/27 prices (integer CHF cents) — last-resort fallback so a
 * price post never renders raw {{tokens}} if the DB read fails (D-PRC values). */
export const FALLBACK_PRICES: Record<Duration, number> = {
  ONE_HOUR: 11000,
  TWO_HOURS: 20000,
  INTENSIVE: 38500,
  FULL_DAY: 50000,
};

const FRANCS = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });
const toFrancs = (cents: number): string => FRANCS.format(Math.round(cents / 100));

/** Cheap guard so callers only hit the DB for posts that actually use prices. */
export function hasPriceTokens(text: string | undefined): boolean {
  return typeof text === "string" && text.includes("{{");
}

/**
 * Replace `{{TOKEN}}` price placeholders with live franc figures — a bare
 * integer with no "CHF" word, so each locale's copy controls placement
 * ("CHF 110" vs "110 CHF"). Derived tokens: `PER_HOUR_FULL_DAY` = full day ÷ 6h,
 * `PER_PERSON_FULL_DAY` = full day ÷ 4 riders. Unknown tokens are left intact.
 */
export function interpolatePrices(
  text: string,
  prices: Record<Duration, number> | null,
): string {
  const p = prices ?? FALLBACK_PRICES;
  const tokens: Record<string, number> = {
    // Per-lesson prices (whole class, 1–4 riders).
    ONE_HOUR: p.ONE_HOUR,
    TWO_HOURS: p.TWO_HOURS,
    INTENSIVE: p.INTENSIVE,
    FULL_DAY: p.FULL_DAY,
    // Per-hour, by duration (lesson ÷ its hours: 1h/2h/4h/6h).
    PER_HOUR_ONE_HOUR: p.ONE_HOUR / 1,
    PER_HOUR_TWO_HOURS: p.TWO_HOURS / 2,
    PER_HOUR_INTENSIVE: p.INTENSIVE / 4,
    PER_HOUR_FULL_DAY: p.FULL_DAY / 6,
    // Per person when a full-day lesson is split across 4 riders.
    PER_PERSON_FULL_DAY: p.FULL_DAY / 4,
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) =>
    key in tokens ? toFrancs(tokens[key]!) : match,
  );
}
