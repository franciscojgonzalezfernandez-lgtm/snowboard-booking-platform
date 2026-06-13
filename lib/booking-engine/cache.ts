import "server-only";

import { unstable_cache } from "next/cache";
import type { Duration } from "@prisma/client";

import { prisma } from "@/lib/db";
import { computeCalendar } from "./calendar";
import { computeSlotsForDate } from "./slots";
import { findNearbyDates, DEFAULT_WINDOW_DAYS } from "./nearby";
import { addDays, startOfUtcDay } from "./time";
import { loadEngineContext } from "./load-context";
import type { CalendarDay, SlotsForDate } from "./types";

// 30-min cap matches the F-049 ticket budget. Mutations (createBookingDraft,
// voidActiveDraft, Stripe webhooks for CONFIRMED / CANCELLED_BY_SYSTEM /
// REFUNDED) call `revalidateTag("availability")` so the cache stays correct
// across writes — the 30-min revalidate is only the floor for idle reads.
const AVAILABILITY_REVALIDATE_SECONDS = 30 * 60;
const AVAILABILITY_TAG = "availability";

export const AVAILABILITY_TAGS = {
  root: AVAILABILITY_TAG,
  duration: (duration: Duration) => `availability:duration:${duration}`,
  month: (monthIso: string) => `availability:month:${monthIso}`,
  date: (dateIso: string) => `availability:date:${dateIso}`,
} as const;

export async function getCachedCalendar(
  duration: Duration,
  monthFromIso: string,
  monthToIso: string,
): Promise<CalendarDay[]> {
  const month = monthFromIso.slice(0, 7);
  return unstable_cache(
    async () => {
      const monthFrom = new Date(monthFromIso);
      const monthTo = new Date(monthToIso);
      const ctx = await loadEngineContext(prisma, {
        from: monthFrom,
        to: monthTo,
      });
      return computeCalendar(ctx, { duration, monthFrom, monthTo });
    },
    ["availability", "calendar", duration, monthFromIso, monthToIso],
    {
      revalidate: AVAILABILITY_REVALIDATE_SECONDS,
      tags: [
        AVAILABILITY_TAGS.root,
        AVAILABILITY_TAGS.duration(duration),
        AVAILABILITY_TAGS.month(month),
      ],
    },
  )();
}

export async function getCachedSlots(
  duration: Duration,
  dateIso: string,
): Promise<SlotsForDate> {
  const dateOnly = dateIso.slice(0, 10);
  return unstable_cache(
    async () => {
      const date = new Date(dateIso);
      const ctx = await loadEngineContext(prisma, { from: date, to: date });
      return computeSlotsForDate(ctx, { duration, date });
    },
    ["availability", "slots", duration, dateIso],
    {
      revalidate: AVAILABILITY_REVALIDATE_SECONDS,
      tags: [
        AVAILABILITY_TAGS.root,
        AVAILABILITY_TAGS.duration(duration),
        AVAILABILITY_TAGS.date(dateOnly),
      ],
    },
  )();
}

export async function getCachedNearby(
  duration: Duration,
  dateIso: string,
): Promise<{ date: string; dates: string[] }> {
  const dateOnly = dateIso.slice(0, 10);
  return unstable_cache(
    async () => {
      const date = new Date(dateIso);
      const ctx = await loadEngineContext(prisma, {
        from: addDays(startOfUtcDay(date), -DEFAULT_WINDOW_DAYS),
        to: addDays(startOfUtcDay(date), DEFAULT_WINDOW_DAYS),
      });
      const dates = findNearbyDates(ctx, { duration, date });
      return { date: dateOnly, dates };
    },
    ["availability", "nearby", duration, dateIso],
    {
      revalidate: AVAILABILITY_REVALIDATE_SECONDS,
      tags: [
        AVAILABILITY_TAGS.root,
        AVAILABILITY_TAGS.duration(duration),
        AVAILABILITY_TAGS.date(dateOnly),
      ],
    },
  )();
}
