import type { Duration } from "@prisma/client";
import { instructorsAvailableOnDate } from "./availability";
import { addDays, startOfUtcDay, toIsoDate } from "./time";
import type { EngineContext } from "./types";

export type NearbyOptions = {
  date: Date;
  duration: Duration;
  /** Search half-window in days (±). Defaults to 14. */
  window?: number;
  /** Minimum results to attempt. Defaults to 3. */
  min?: number;
  /** Maximum results to return. Defaults to 5. */
  max?: number;
};

export const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_MIN = 3;
const DEFAULT_MAX = 5;

/**
 * Returns the 3-5 closest dates around `opts.date` (excluding it) that have
 * availability for the given duration. Expands outward day by day to stay
 * predictable; the closer match always wins ties.
 */
export function findNearbyDates(
  ctx: EngineContext,
  opts: NearbyOptions,
): string[] {
  const target = startOfUtcDay(opts.date);
  const window = opts.window ?? DEFAULT_WINDOW_DAYS;
  const min = opts.min ?? DEFAULT_MIN;
  const max = opts.max ?? DEFAULT_MAX;
  const results: string[] = [];

  for (let offset = 1; offset <= window; offset++) {
    const forward = addDays(target, offset);
    if (instructorsAvailableOnDate(ctx, forward, opts.duration).length > 0) {
      results.push(toIsoDate(forward));
      if (results.length >= max) return results;
    }
    const backward = addDays(target, -offset);
    if (instructorsAvailableOnDate(ctx, backward, opts.duration).length > 0) {
      results.push(toIsoDate(backward));
      if (results.length >= max) return results;
    }
    if (results.length >= min && offset >= Math.ceil(window / 2)) {
      // We have enough results and have looked far enough; bail out so we
      // don't keep scanning the whole window when 3 close dates suffice.
      return results;
    }
  }
  return results;
}
