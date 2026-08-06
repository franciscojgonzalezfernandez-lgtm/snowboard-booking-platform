import type { Duration } from "@prisma/client";

/**
 * The four lesson products, as one source of truth for every surface that
 * renders them (home, pricing page, JSON-LD). Before F-132 the `Duration` →
 * i18n-key map was copy-pasted in three files and the home kept its own
 * hand-written tier list, so a new duration meant editing all of them.
 *
 * `Duration` is imported as a *type only* — the home page must stay
 * prerenderable and free of a runtime Prisma import (F-124).
 */
export type TierKey = "oneHour" | "twoHours" | "intensive" | "fullDay";

/** Rider-facing ladder, short → full day. Card order on every surface. */
export const TIER_ORDER = [
  "ONE_HOUR",
  "TWO_HOURS",
  "INTENSIVE",
  "FULL_DAY",
] as const satisfies readonly Duration[];

/** Prisma `Duration` → the `pricing.tier.*` i18n key. */
export const TIER_KEY: Record<Duration, TierKey> = {
  ONE_HOUR: "oneHour",
  TWO_HOURS: "twoHours",
  INTENSIVE: "intensive",
  FULL_DAY: "fullDay",
};

/**
 * Product photo per tier. The cards render 4:3 and `object-cover` does the
 * rest, so a replacement only has to be 4:3 and at least ~1300px wide (twice
 * the widest slot a card gets) — swap the file in `public/brand/tiers/`, not
 * the code.
 */
export const TIER_PHOTO: Record<TierKey, string> = {
  oneHour: "/brand/tiers/one-hour.jpg",
  twoHours: "/brand/tiers/two-hours.jpg",
  intensive: "/brand/tiers/intensive.jpg",
  fullDay: "/brand/tiers/full-day.jpg",
};

/**
 * The tier Javi points people at. Drives the "the one I recommend" flag and the
 * accent border on both surfaces — one highlighted product, never more.
 */
export const RECOMMENDED_TIER: TierKey = "intensive";
