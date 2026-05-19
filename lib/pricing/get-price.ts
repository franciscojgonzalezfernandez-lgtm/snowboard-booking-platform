import { Duration, Prisma, type Season } from "@prisma/client";

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
