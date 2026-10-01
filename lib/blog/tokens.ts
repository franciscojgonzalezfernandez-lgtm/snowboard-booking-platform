import { Duration } from "@prisma/client";

import { HOURS_BY_DURATION } from "@/lib/pricing/tiers";
import { SEASON } from "@/lib/seo/business";

// F-145/F-147 — render-time token interpolation for answer-posts. The copy must
// never hardcode a value that can go stale: CHF prices change when an admin
// edits them (F-144), and the season label rolls over every year (F-147). So
// the MDX carries {{TOKEN}} placeholders that the blog page fills at render —
// prices from the active season (getActiveSeasonPrices), season-/length facts
// from the single sources in code — keeping the visible text, the meta
// description and the FAQPage/BlogPosting JSON-LD in lockstep.

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

/**
 * Non-price tokens: dated/attributable facts that don't need a DB read (F-147).
 * `SEASON` is the only value here that drifts (annually) and was previously
 * hardcoded as a bare "2026/27" across ~18 MDX files in three locales — now it
 * resolves from {@link SEASON.label}, the same source the Offer's
 * `priceValidUntil` quotes, so the copy and the JSON-LD can't disagree.
 */
const FACT_TOKENS: Record<string, string> = {
  SEASON: SEASON.label,
};

/** Cheap guard so callers only hit the DB for posts that actually use tokens. */
export function hasTokens(text: string | undefined): boolean {
  return typeof text === "string" && text.includes("{{");
}

/**
 * Replace `{{TOKEN}}` placeholders. Price tokens become a bare integer with no
 * "CHF" word, so each locale's copy controls placement ("CHF 110" vs "110 CHF");
 * derived price tokens: `PER_HOUR_<D>` = lesson ÷ its hours ({@link
 * HOURS_BY_DURATION}), `PER_PERSON_FULL_DAY` = full day ÷ 4 riders. Fact tokens
 * ({@link FACT_TOKENS}) render verbatim. Unknown tokens are left intact.
 */
export function interpolateTokens(
  text: string,
  prices: Record<Duration, number> | null,
): string {
  const p = prices ?? FALLBACK_PRICES;
  const tokens: Record<string, string> = {
    ...FACT_TOKENS,
    // Per-lesson prices (whole class, 1–4 riders).
    ONE_HOUR: toFrancs(p.ONE_HOUR),
    TWO_HOURS: toFrancs(p.TWO_HOURS),
    INTENSIVE: toFrancs(p.INTENSIVE),
    FULL_DAY: toFrancs(p.FULL_DAY),
    // Per-hour, by duration (lesson ÷ its hours: 1h/2h/4h/6h).
    PER_HOUR_ONE_HOUR: toFrancs(p.ONE_HOUR / HOURS_BY_DURATION.ONE_HOUR),
    PER_HOUR_TWO_HOURS: toFrancs(p.TWO_HOURS / HOURS_BY_DURATION.TWO_HOURS),
    PER_HOUR_INTENSIVE: toFrancs(p.INTENSIVE / HOURS_BY_DURATION.INTENSIVE),
    PER_HOUR_FULL_DAY: toFrancs(p.FULL_DAY / HOURS_BY_DURATION.FULL_DAY),
    // Per person when a full-day lesson is split across 4 riders.
    PER_PERSON_FULL_DAY: toFrancs(p.FULL_DAY / 4),
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) =>
    key in tokens ? tokens[key]! : match,
  );
}
