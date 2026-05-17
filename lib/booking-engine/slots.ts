import type { Duration } from "@prisma/client";
import { instructorAvailableAt } from "./availability";
import { startOfUtcDay, toIsoDate } from "./time";
import type {
  EngineContext,
  EngineInstructor,
  SlotAnchor,
  SlotInstructor,
  SlotsForDate,
} from "./types";

export type SlotsOptions = {
  date: Date;
  duration: Duration;
};

function rankInstructors(
  ctx: EngineContext,
  date: Date,
  candidates: EngineInstructor[],
): EngineInstructor[] {
  const sameDay = (id: string) =>
    ctx.bookings.filter(
      (b) =>
        b.instructorId === id &&
        b.date.getUTCFullYear() === date.getUTCFullYear() &&
        b.date.getUTCMonth() === date.getUTCMonth() &&
        b.date.getUTCDate() === date.getUTCDate(),
    ).length;

  // Ascending workload of the day; stable on id so output is deterministic
  // across machines and across requests (key for round-robin behavior).
  return [...candidates].sort((a, b) => {
    const diff = sameDay(a.id) - sameDay(b.id);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

function toCard(instructor: EngineInstructor): SlotInstructor {
  return {
    id: instructor.id,
    name: instructor.name ?? null,
    photo: instructor.photo ?? null,
    specialties: instructor.specialties ?? [],
    languages: instructor.languages,
  };
}

/**
 * For a given date + duration, returns a row per anchor time with the list
 * of instructors that can host it, ordered by least-busy first.
 *
 * PRD §6.2: language is NOT a filter — it is exposed on the instructor card
 * so the client picks it manually in the UI.
 */
export function computeSlotsForDate(
  ctx: EngineContext,
  opts: SlotsOptions,
): SlotsForDate {
  const day = startOfUtcDay(opts.date);
  const result: SlotsForDate = { date: toIsoDate(day), anchorTimes: [] };

  if (!ctx.season) return result;

  for (const anchorTime of ctx.season.anchorTimes) {
    const candidates = ctx.instructors.filter((instructor) =>
      instructorAvailableAt(ctx, {
        instructor,
        date: day,
        anchorTime,
        duration: opts.duration,
      }),
    );

    const ranked = rankInstructors(ctx, day, candidates);
    const row: SlotAnchor = {
      time: anchorTime,
      available: ranked.length > 0,
      instructors: ranked.map(toCard),
    };
    result.anchorTimes.push(row);
  }
  return result;
}
