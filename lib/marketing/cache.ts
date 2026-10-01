import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";

// F-141/F-142: cache tags for the owner-authored marketing data shown on the
// otherwise-static home + pricing pages. The reads below are wrapped in
// `unstable_cache` so those pages stay statically rendered (no request-scoped
// data, F-124), while the admin actions call `revalidateTag(...)` to surface a
// price/promo/banner change immediately across all three locales at once —
// cleaner than trying to `revalidatePath` each localized pricing slug.

export const MARKETING_TAGS = {
  /** Active-season pricing (regular + promo). Busted by the pricing editor. */
  pricing: "marketing-pricing",
  /** Enabled ad banners. Busted by the announcements editor. */
  banners: "ad-banners",
} as const;

/**
 * The active season's pricing row (regular + promo columns), cached under the
 * `pricing` tag. Shared by the home tier cards and the /precios page so both
 * resolve promos identically. `null` when there is no active season.
 */
export const getActiveSeasonForPricing = unstable_cache(
  async () => {
    // Degrade to `null` if the DB is unreachable instead of throwing. The home
    // + /precios tier cards read this on render and must still render without a
    // database (F-022/F-124: CI builds and smoke-tests with no Postgres). The
    // callers already treat `null` as "no prices shown"; mirrors the
    // try/catch → null convention in lib/seo/price-range.ts.
    try {
      return await prisma.season.findFirst({
        where: { active: true },
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          priceCentsByDuration: true,
          promoPriceCentsByDuration: true,
          promoLabelByDuration: true,
        },
      });
    } catch {
      return null;
    }
  },
  ["active-season-pricing"],
  { tags: [MARKETING_TAGS.pricing] },
);

/**
 * Enabled ad banners in display order, cached under the `banners` tag. Consumed
 * by the home hero band (`HeroAnnouncement`).
 */
export const getEnabledAdBanners = unstable_cache(
  async () => {
    // Degrade to `[]` if the DB is unreachable instead of throwing — the home
    // hero band renders on every home load and must survive a no-Postgres build
    // (F-022/F-124). `HeroAnnouncement` renders nothing for an empty list.
    try {
      return await prisma.adBanner.findMany({
        where: { enabled: true },
        orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
        select: { id: true, body: true, ctaLabel: true, ctaHref: true },
      });
    } catch {
      return [];
    }
  },
  ["enabled-ad-banners"],
  { tags: [MARKETING_TAGS.banners] },
);
