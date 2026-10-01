import { Duration, Prisma } from "@prisma/client";

import type { Db } from "@/lib/db";
import {
  getPriceCents,
  getPromoLabelEntry,
  getPromoPriceCents,
  type LocalizedText,
} from "@/lib/pricing/get-price";
import {
  updateSeasonPricingSchema,
  type UpdateSeasonPricingInput,
} from "@/lib/schemas/pricing";

// Pure, dependency-injected cores for the admin pricing editor (F-080; promos
// F-141). They live in `lib/` (not the `"use server"` module in `app/`) so
// Vitest can drive them with a fake Prisma — the thin wrappers in
// `app/(ops)/admin/actions.ts` gate on `requireAdmin()` + revalidate around
// these.
//
// The editor writes the active season's `priceCentsByDuration` (regular prices)
// plus the optional promo columns `promoPriceCentsByDuration` +
// `promoLabelByDuration`. Regular prices are always written as a complete
// four-key map; promo columns are a partial map (only promoted durations) or
// SQL NULL when nothing is promoted.

const DURATION_KEYS = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
] as const;

export type AdminPricingDeps = {
  prisma: Db;
};

export type AdminPricingError =
  | "INVALID_INPUT"
  | "NO_ACTIVE_SEASON"
  // A promotion cannot go live without at least one enabled ad banner to
  // advertise it (F-142). The reverse guard lives in lib/admin/announcements.ts.
  | "PROMO_REQUIRES_BANNER";

export type UpdateSeasonPricingResult =
  | { ok: true }
  | { ok: false; error: AdminPricingError };

export async function updateSeasonPricingWith(
  deps: AdminPricingDeps,
  input: UpdateSeasonPricingInput,
): Promise<UpdateSeasonPricingResult> {
  const parsed = updateSeasonPricingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const season = await deps.prisma.season.findFirst({
    where: { active: true },
    select: { id: true },
  });
  if (!season) return { ok: false, error: "NO_ACTIVE_SEASON" };

  // Build the partial promo maps from the validated per-duration entries.
  const promoPriceCentsByDuration: Record<string, number> = {};
  const promoLabelByDuration: Record<string, LocalizedText> = {};
  let hasPromo = false;
  for (const duration of DURATION_KEYS) {
    const entry = parsed.data.promos?.[duration];
    if (entry) {
      hasPromo = true;
      promoPriceCentsByDuration[duration] = entry.priceCents;
      promoLabelByDuration[duration] = entry.label;
    }
  }

  // A live promo must have somewhere to be advertised (F-142). Checked before
  // the write so the season is never left promoted with no banner.
  if (hasPromo) {
    const enabledBanners = await deps.prisma.adBanner.count({
      where: { enabled: true },
    });
    if (enabledBanners === 0) return { ok: false, error: "PROMO_REQUIRES_BANNER" };
  }

  // Persist all four regular keys at once — never a partial map, so reads via
  // `getPriceCents` always see a complete record. Promo columns are the partial
  // map, or SQL NULL (`Prisma.DbNull`) when nothing is promoted.
  await deps.prisma.season.update({
    where: { id: season.id },
    data: {
      priceCentsByDuration: {
        ONE_HOUR: parsed.data.ONE_HOUR,
        TWO_HOURS: parsed.data.TWO_HOURS,
        INTENSIVE: parsed.data.INTENSIVE,
        FULL_DAY: parsed.data.FULL_DAY,
      },
      promoPriceCentsByDuration: hasPromo
        ? promoPriceCentsByDuration
        : Prisma.DbNull,
      promoLabelByDuration: hasPromo ? promoLabelByDuration : Prisma.DbNull,
    },
  });

  return { ok: true };
}

/** True when the active season has at least one validly-priced promotion. */
export async function activeSeasonHasPromo(
  deps: AdminPricingDeps,
): Promise<boolean> {
  const season = await deps.prisma.season.findFirst({
    where: { active: true },
    select: { promoPriceCentsByDuration: true },
  });
  if (!season) return false;
  return DURATION_KEYS.some(
    (duration) => getPromoPriceCents(season, duration) !== null,
  );
}

export type ActivePromo = {
  /** Stored promo price in CHF cents. */
  priceCents: number;
  /** Localized copy, or `null` if somehow missing (form renders empty inputs). */
  label: LocalizedText | null;
};

export type ActiveSeasonPricing = {
  seasonId: string;
  seasonName: string;
  /** Regular cents per duration; `null` when the active season has no price for it yet. */
  priceCentsByDuration: Record<Duration, number | null>;
  /** Promo per duration; `null` when that duration is not promoted. */
  promoByDuration: Record<Duration, ActivePromo | null>;
};

export type GetActiveSeasonPricingResult =
  | { ok: true; pricing: ActiveSeasonPricing }
  | { ok: false; error: "NO_ACTIVE_SEASON" };

export async function getActiveSeasonPricingWith(
  deps: AdminPricingDeps,
): Promise<GetActiveSeasonPricingResult> {
  const season = await deps.prisma.season.findFirst({
    where: { active: true },
    select: {
      id: true,
      name: true,
      priceCentsByDuration: true,
      promoPriceCentsByDuration: true,
      promoLabelByDuration: true,
    },
  });
  if (!season) return { ok: false, error: "NO_ACTIVE_SEASON" };

  // Read each key defensively: a freshly-migrated `{}` (or any missing key)
  // surfaces as `null` so the form renders empty inputs instead of throwing.
  const priceCentsByDuration = {} as Record<Duration, number | null>;
  const promoByDuration = {} as Record<Duration, ActivePromo | null>;
  for (const duration of DURATION_KEYS) {
    try {
      priceCentsByDuration[duration] = getPriceCents(
        { id: season.id, priceCentsByDuration: season.priceCentsByDuration },
        duration,
      );
    } catch {
      priceCentsByDuration[duration] = null;
    }

    const promoPrice = getPromoPriceCents(season, duration);
    promoByDuration[duration] =
      promoPrice !== null
        ? { priceCents: promoPrice, label: getPromoLabelEntry(season, duration) }
        : null;
  }

  return {
    ok: true,
    pricing: {
      seasonId: season.id,
      seasonName: season.name,
      priceCentsByDuration,
      promoByDuration,
    },
  };
}
