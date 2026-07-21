import { startOfUtcDay } from "@/lib/booking-engine/time";

// F-115 — turns the active Season's date window into a display state for the
// "Plan your visit" page. Pure (window + now in → tagged status out) so it
// unit-tests without a DB. Compared at UTC-day granularity because
// `Season.startDate`/`endDate` are `@db.Date` (UTC-midnight, date-only), so the
// season stays "active" through the whole of its last day.
export type SeasonWindow = { startDate: Date; endDate: Date } | null;

export type SeasonStatus =
  | { kind: "active"; endDate: Date }
  | { kind: "upcoming"; startDate: Date; endDate: Date }
  | { kind: "none" };

export function seasonStatus(season: SeasonWindow, now: Date): SeasonStatus {
  if (!season) return { kind: "none" };
  const today = startOfUtcDay(now);
  if (today < season.startDate) {
    return {
      kind: "upcoming",
      startDate: season.startDate,
      endDate: season.endDate,
    };
  }
  if (today <= season.endDate) {
    return { kind: "active", endDate: season.endDate };
  }
  return { kind: "none" };
}
