import { Duration, Prisma, type Locale, type Season } from "@prisma/client";

const DURATION_KEYS: readonly Duration[] = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
];

export class PriceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceConfigurationError";
  }
}

function isPriceMap(value: unknown): value is Record<string, number> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  for (const v of Object.values(value)) {
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
      return false;
    }
  }
  return true;
}

export function getPriceCents(
  season: Pick<Season, "id" | "priceCentsByDuration">,
  duration: Duration,
): number {
  const raw = season.priceCentsByDuration as Prisma.JsonValue;
  if (!isPriceMap(raw)) {
    throw new PriceConfigurationError(
      `Season ${season.id} has malformed priceCentsByDuration; expected Record<Duration, positive integer cents>.`,
    );
  }
  const value = raw[duration];
  if (typeof value !== "number") {
    throw new PriceConfigurationError(
      `Season ${season.id} is missing a price for duration ${duration}.`,
    );
  }
  return value;
}

export function assertSeasonPricesComplete(
  season: Pick<Season, "id" | "priceCentsByDuration">,
): void {
  for (const duration of DURATION_KEYS) {
    getPriceCents(season, duration);
  }
}

// ---------------------------------------------------------------------------
// F-141 promotional pricing
// ---------------------------------------------------------------------------

/** Admin-authored copy stored per locale (promo labels, ad-banner text). */
export type LocalizedText = { en: string; de: string; es: string };

export type ResolvedPrice = {
  /** Effective (charged) price in CHF cents: the promo when one validly applies, else the regular price. */
  cents: number;
  /** Regular (pre-promo) price in CHF cents. Equals `cents` when no promo applies. */
  originalCents: number;
  /** True when a valid promotional price replaced the regular one. */
  isPromo: boolean;
};

function isPromoLabelMap(value: unknown): value is Record<string, LocalizedText> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  for (const v of Object.values(value)) {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
    const label = v as Record<string, unknown>;
    for (const loc of ["en", "de", "es"] as const) {
      if (typeof label[loc] !== "string") return false;
    }
  }
  return true;
}

/**
 * Resolve the price a booker actually pays for a duration (F-141). The single
 * source of truth for "which price applies".
 *
 * A promotion is honored ONLY when it is present, an integer, strictly positive,
 * and strictly below the regular price — any malformed or non-discount promo is
 * ignored and the regular price stands, so a mis-entered promo can never raise
 * the price or render a nonsensical strikethrough. Future gating (end dates,
 * stock limits) belongs here and nowhere else. Throws `PriceConfigurationError`
 * (via `getPriceCents`) when the regular price itself is missing/malformed.
 */
export function resolvePriceCents(
  season: Pick<
    Season,
    "id" | "priceCentsByDuration" | "promoPriceCentsByDuration"
  >,
  duration: Duration,
): ResolvedPrice {
  const originalCents = getPriceCents(season, duration);

  const rawPromo = season.promoPriceCentsByDuration as Prisma.JsonValue;
  if (isPriceMap(rawPromo)) {
    const promo = rawPromo[duration];
    if (
      typeof promo === "number" &&
      Number.isInteger(promo) &&
      promo > 0 &&
      promo < originalCents
    ) {
      return { cents: promo, originalCents, isPromo: true };
    }
  }
  return { cents: originalCents, originalCents, isPromo: false };
}

/**
 * Raw stored promo price in CHF cents for a duration, or `null` when none is
 * configured. Validates only that it is a positive integer — the "below regular"
 * check lives in `resolvePriceCents`. Used by the admin editor to pre-fill the
 * promo field with exactly what is stored.
 */
export function getPromoPriceCents(
  season: Pick<Season, "promoPriceCentsByDuration">,
  duration: Duration,
): number | null {
  const raw = season.promoPriceCentsByDuration as Prisma.JsonValue;
  if (!isPriceMap(raw)) return null;
  const value = raw[duration];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

/**
 * The full `{ en, de, es }` promo label for a duration, or `null` when none is
 * configured. Used by the admin editor to pre-fill the three label inputs.
 */
export function getPromoLabelEntry(
  season: Pick<Season, "promoLabelByDuration">,
  duration: Duration,
): LocalizedText | null {
  const raw = season.promoLabelByDuration as Prisma.JsonValue;
  if (!isPromoLabelMap(raw)) return null;
  return raw[duration] ?? null;
}

/**
 * The localized promotional copy for a duration, or `null` when the duration has
 * no promo label configured. Falls back to English when the requested locale's
 * entry is empty (defensive — admin validation requires all three, F-141).
 * Independent of `resolvePriceCents`: callers pair it with `isPromo`.
 */
export function getPromoLabel(
  season: Pick<Season, "promoLabelByDuration">,
  duration: Duration,
  locale: Locale,
): string | null {
  const label = getPromoLabelEntry(season, duration);
  if (!label) return null;
  const preferred = label[locale];
  if (typeof preferred === "string" && preferred.trim().length > 0) return preferred;
  if (label.en.trim().length > 0) return label.en;
  return null;
}
