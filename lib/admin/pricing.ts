import { Duration } from "@prisma/client";

import type { Db } from "@/lib/db";
import { getPriceCents } from "@/lib/pricing/get-price";
import {
  updateSeasonPricingSchema,
  type UpdateSeasonPricingInput,
} from "@/lib/schemas/pricing";

// Pure, dependency-injected cores for the admin pricing editor (F-080). They
// live in `lib/` (not the `"use server"` module in `app/`) so Vitest can drive
// them with a fake Prisma — the thin wrappers in `app/admin/actions.ts` gate on
// `requireAdmin()` + revalidate around these.
//
// The editor writes the `Season.priceCentsByDuration` JSON of the *active*
// season. No new table (F-039 owns the column). Reads go through
// `lib/pricing/get-price.ts` which throws on a missing/malformed key, so the
// store is always a complete `Record<Duration, positive integer cents>`.

const DURATION_KEYS = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
] as const;

export type AdminPricingDeps = {
  prisma: Db;
};

export type AdminPricingError = "INVALID_INPUT" | "NO_ACTIVE_SEASON";

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

  // Persist all four keys at once — never a partial map, so reads via
  // `getPriceCents` always see a complete record.
  await deps.prisma.season.update({
    where: { id: season.id },
    data: {
      priceCentsByDuration: {
        ONE_HOUR: parsed.data.ONE_HOUR,
        TWO_HOURS: parsed.data.TWO_HOURS,
        INTENSIVE: parsed.data.INTENSIVE,
        FULL_DAY: parsed.data.FULL_DAY,
      },
    },
  });

  return { ok: true };
}

export type ActiveSeasonPricing = {
  seasonId: string;
  seasonName: string;
  /** Cents per duration; `null` when the active season has no price for it yet. */
  priceCentsByDuration: Record<Duration, number | null>;
};

export type GetActiveSeasonPricingResult =
  | { ok: true; pricing: ActiveSeasonPricing }
  | { ok: false; error: "NO_ACTIVE_SEASON" };

export async function getActiveSeasonPricingWith(
  deps: AdminPricingDeps,
): Promise<GetActiveSeasonPricingResult> {
  const season = await deps.prisma.season.findFirst({
    where: { active: true },
    select: { id: true, name: true, priceCentsByDuration: true },
  });
  if (!season) return { ok: false, error: "NO_ACTIVE_SEASON" };

  // Read each key defensively: a freshly-migrated `{}` (or any missing key)
  // surfaces as `null` so the form renders empty inputs instead of throwing.
  const priceCentsByDuration = DURATION_KEYS.reduce(
    (acc, duration) => {
      try {
        acc[duration] = getPriceCents(
          { id: season.id, priceCentsByDuration: season.priceCentsByDuration },
          duration,
        );
      } catch {
        acc[duration] = null;
      }
      return acc;
    },
    {} as Record<Duration, number | null>,
  );

  return {
    ok: true,
    pricing: {
      seasonId: season.id,
      seasonName: season.name,
      priceCentsByDuration,
    },
  };
}
