import "server-only";

import { unstable_cache } from "next/cache";
import { Duration } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getPriceCents } from "@/lib/pricing/get-price";

// The LocalBusiness node (F-100) lives in the marketing layout, so it renders on
// every marketing page. Reading the active Season for `priceRange` on each render
// would add a DB hit to the hot path, so it is cached (1h, same window as the
// /precios ISR). Prices are the four lesson durations; the range is the CHF
// min–max. Any misconfigured season degrades to `null` → the node simply omits
// `priceRange`.

const DURATIONS: readonly Duration[] = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
];

const CHF = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });

async function readSeasonPriceRange(): Promise<string | null> {
  const season = await prisma.season.findFirst({
    where: { active: true },
    orderBy: { startDate: "asc" },
    select: { id: true, priceCentsByDuration: true },
  });
  if (!season) return null;

  try {
    const prices = DURATIONS.map((d) => getPriceCents(season, d));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `CHF ${CHF.format(min / 100)}–${CHF.format(max / 100)}`;
  } catch {
    // PriceConfigurationError → no honest range to show; omit priceRange.
    return null;
  }
}

export const getSeasonPriceRange = unstable_cache(
  readSeasonPriceRange,
  ["seo-season-price-range"],
  { revalidate: 3600 },
);
