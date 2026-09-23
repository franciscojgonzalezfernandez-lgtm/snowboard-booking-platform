import "server-only";

import { unstable_cache } from "next/cache";
import { Duration } from "@prisma/client";

import { prisma } from "@/lib/db";
import { MARKETING_TAGS } from "@/lib/marketing/cache";
import { resolvePriceCents } from "@/lib/pricing/get-price";

// The LocalBusiness node (F-100) lives in the marketing layout, so it renders on
// every marketing page. Reading the active Season for `priceRange` on each render
// would add a DB hit to the hot path, so it is cached (1h, same window as the
// /precios ISR). Prices are the four lesson durations; the range is the CHF
// min–max. Any misconfigured season degrades to `null` → the node simply omits
// `priceRange`.

// Cache tag so an owner price edit (F-144) can bust this immediately via
// `revalidateTag`, instead of waiting out the 1h window with a stale range.
export const SEASON_PRICE_RANGE_TAG = "seo-season-price-range";

const DURATIONS: readonly Duration[] = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
];

const CHF = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });

async function readSeasonPriceRange(): Promise<string | null> {
  try {
    const season = await prisma.season.findFirst({
      where: { active: true },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        priceCentsByDuration: true,
        promoPriceCentsByDuration: true,
      },
    });
    if (!season) return null;

    // Effective (promo-aware) prices, so the advertised range matches what a
    // customer actually pays (F-141).
    const prices = DURATIONS.map((d) => resolvePriceCents(season, d).cents);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `CHF ${CHF.format(min / 100)}–${CHF.format(max / 100)}`;
  } catch {
    // priceRange is a decorative hint on the LocalBusiness node that renders on
    // EVERY marketing page (via the layout). It must never take down the whole
    // marketing surface — so any failure (DB unreachable, no schema/seed as in
    // CI, or a misconfigured season) degrades to no priceRange, not a 500.
    return null;
  }
}

export const getSeasonPriceRange = unstable_cache(
  readSeasonPriceRange,
  [SEASON_PRICE_RANGE_TAG],
  // Tagged under BOTH the SEO range tag (F-144) and the marketing `pricing`
  // tag (F-141) so either an owner price edit or a promo edit busts it
  // immediately; the 1h window is the fallback.
  { revalidate: 3600, tags: [SEASON_PRICE_RANGE_TAG, MARKETING_TAGS.pricing] },
);

// All four active-season prices (integer CHF cents), for surfaces that need the
// exact numbers rather than the min–max range — e.g. the price answer-post whose
// copy interpolates live prices (F-145). Promo-aware (F-141): returns the
// EFFECTIVE price per duration via resolvePriceCents, so the answer-post
// advertises what a customer actually pays — consistent with the min–max range
// above. Cached under the same two tags so a price OR promo edit busts it. Any
// misconfigured/absent season degrades to `null` (caller supplies a fallback).
async function readActiveSeasonPrices(): Promise<Record<Duration, number> | null> {
  try {
    const season = await prisma.season.findFirst({
      where: { active: true },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        priceCentsByDuration: true,
        promoPriceCentsByDuration: true,
      },
    });
    if (!season) return null;
    return Object.fromEntries(
      DURATIONS.map((d) => [d, resolvePriceCents(season, d).cents]),
    ) as Record<Duration, number>;
  } catch {
    return null;
  }
}

export const getActiveSeasonPrices = unstable_cache(
  readActiveSeasonPrices,
  [`${SEASON_PRICE_RANGE_TAG}:all`],
  { revalidate: 3600, tags: [SEASON_PRICE_RANGE_TAG, MARKETING_TAGS.pricing] },
);
