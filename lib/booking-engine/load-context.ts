import type { PrismaClient } from "@prisma/client";
import { addDays, startOfUtcDay } from "./time";
import type { EngineContext } from "./types";

export type LoadContextOptions = {
  /** Earliest date the caller cares about (inclusive). */
  from: Date;
  /** Latest date the caller cares about (inclusive). */
  to: Date;
  /** Reference "now" — defaults to `new Date()`. Tests should pass a fixed clock. */
  now?: Date;
};

/**
 * Hydrates an `EngineContext` from the database. The engine itself stays pure;
 * this loader is the only place that talks to Prisma so the rest of the module
 * can be unit-tested with fixtures.
 *
 * The query window is widened by 24h on each side so the engine can evaluate
 * the 24h-advance rule and the 10-minute buffer near the boundary correctly.
 */
export async function loadEngineContext(
  prisma: PrismaClient,
  opts: LoadContextOptions,
): Promise<EngineContext> {
  const now = opts.now ?? new Date();
  const rangeStart = addDays(startOfUtcDay(opts.from), -1);
  const rangeEnd = addDays(startOfUtcDay(opts.to), 2);

  const [season, instructors, availabilityBlocks, bookings] = await Promise.all([
    prisma.season.findFirst({
      where: {
        active: true,
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.instructor.findMany({
      where: { active: true },
      select: {
        id: true,
        active: true,
        acceptsSameDayIfBooked: true,
        languages: true,
        photo: true,
        specialties: true,
        user: { select: { name: true } },
      },
    }),
    prisma.availabilityBlock.findMany({
      where: {
        startDateTime: { lt: rangeEnd },
        endDateTime: { gt: rangeStart },
      },
      select: {
        instructorId: true,
        startDateTime: true,
        endDateTime: true,
        kind: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        instructorId: true,
        date: true,
        anchorTime: true,
        duration: true,
        status: true,
      },
    }),
  ]);

  return {
    now,
    season: season
      ? {
          startDate: season.startDate,
          endDate: season.endDate,
          active: season.active,
          anchorTimes: season.anchorTimes,
          operatingHoursStart: season.operatingHoursStart,
          operatingHoursEnd: season.operatingHoursEnd,
        }
      : null,
    instructors: instructors.map((i) => ({
      id: i.id,
      active: i.active,
      acceptsSameDayIfBooked: i.acceptsSameDayIfBooked,
      languages: i.languages,
      name: i.user.name ?? null,
      photo: i.photo ?? null,
      specialties: i.specialties,
    })),
    availabilityBlocks,
    bookings,
  };
}
