import { AvailabilityKind } from "@prisma/client";
import { z } from "zod";

import { addDays, startOfUtcDay, toIsoDate } from "@/lib/booking-engine/time";
import type { Db } from "@/lib/db";

import {
  blockOverlapsBookings,
  buildOpenRangeBlocks,
  OCCUPYING_BOOKING_STATUSES,
  validateBlockWindow,
  type BookingInterval,
} from "./availability";

// Pure, dependency-injected cores for the instructor availability actions. They
// live in `lib/` (not the `"use server"` module in `app/`) so Vitest can drive
// them without pulling `next/headers` — the thin wrappers in
// `app/instructor/actions.ts` resolve the instructor + revalidate around these.

// Defensive cap: opening a giant range would mass-insert blocks. A season is a
// few months, so 92 days (~one quarter) is generous headroom.
export const MAX_OPEN_RANGE_DAYS = 92;

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE");
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "INVALID_TIME");

const openRangeSchema = z
  .object({ fromDate: ISO_DATE, toDate: ISO_DATE })
  .refine((v) => v.fromDate <= v.toDate, { message: "INVALID_RANGE" });

const blockWindowSchema = z.object({
  date: ISO_DATE,
  startTime: HHMM,
  endTime: HHMM,
});

const clearSchema = z.object({ blockId: z.string().min(1) });

export type AvailabilityActionError =
  | "INVALID_INPUT"
  | "NO_ACTIVE_SEASON"
  | "RANGE_TOO_LONG"
  | "OUT_OF_HOURS"
  | "INVALID_RANGE"
  | "HAS_BOOKINGS"
  | "NOT_FOUND"
  | "FORBIDDEN";

export type OpenRangeResult =
  | { ok: true; created: number }
  | { ok: false; error: AvailabilityActionError };
export type BlockWindowResult =
  | { ok: true; blockId: string }
  | { ok: false; error: AvailabilityActionError };
export type ClearResult =
  | { ok: true }
  | { ok: false; error: AvailabilityActionError };

function dayUtc(iso: string): Date {
  return startOfUtcDay(new Date(`${iso}T00:00:00.000Z`));
}

export type AvailabilityDeps = {
  prisma: Db;
  instructorId: string;
  now?: Date;
};

export async function openAvailabilityRangeWith(
  deps: AvailabilityDeps,
  input: { fromDate: string; toDate: string },
): Promise<OpenRangeResult> {
  const parsed = openRangeSchema.safeParse(input);
  if (!parsed.success) {
    const isRange = parsed.error.issues.some((i) => i.message === "INVALID_RANGE");
    return { ok: false, error: isRange ? "INVALID_RANGE" : "INVALID_INPUT" };
  }
  const fromDay = dayUtc(parsed.data.fromDate);
  const toDay = dayUtc(parsed.data.toDate);
  const spanDays =
    Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000) + 1;
  if (spanDays > MAX_OPEN_RANGE_DAYS) return { ok: false, error: "RANGE_TOO_LONG" };

  const season = await deps.prisma.season.findFirst({
    where: { active: true },
    select: { id: true, operatingHoursStart: true, operatingHoursEnd: true },
  });
  if (!season) return { ok: false, error: "NO_ACTIVE_SEASON" };

  const existing = await deps.prisma.availabilityBlock.findMany({
    where: {
      instructorId: deps.instructorId,
      kind: AvailabilityKind.AVAILABLE,
      startDateTime: { gte: fromDay, lt: addDays(toDay, 1) },
    },
    select: { startDateTime: true },
  });
  const alreadyOpenIsoDates = new Set(
    existing.map((b) => toIsoDate(startOfUtcDay(b.startDateTime))),
  );

  const blocks = buildOpenRangeBlocks({
    fromDay,
    toDay,
    operatingHoursStart: season.operatingHoursStart,
    operatingHoursEnd: season.operatingHoursEnd,
    alreadyOpenIsoDates,
  });
  if (blocks.length === 0) return { ok: true, created: 0 };

  const result = await deps.prisma.availabilityBlock.createMany({
    data: blocks.map((b) => ({
      instructorId: deps.instructorId,
      startDateTime: b.startDateTime,
      endDateTime: b.endDateTime,
      kind: AvailabilityKind.AVAILABLE,
    })),
  });
  return { ok: true, created: result.count };
}

export async function blockAvailabilityWindowWith(
  deps: AvailabilityDeps,
  input: { date: string; startTime: string; endTime: string },
): Promise<BlockWindowResult> {
  const parsed = blockWindowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const season = await deps.prisma.season.findFirst({
    where: { active: true },
    select: { id: true, operatingHoursStart: true, operatingHoursEnd: true },
  });
  if (!season) return { ok: false, error: "NO_ACTIVE_SEASON" };

  const validated = validateBlockWindow({
    day: dayUtc(parsed.data.date),
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    operatingHoursStart: season.operatingHoursStart,
    operatingHoursEnd: season.operatingHoursEnd,
  });
  if (!validated.ok) return { ok: false, error: validated.error };

  const created = await deps.prisma.availabilityBlock.create({
    data: {
      instructorId: deps.instructorId,
      startDateTime: validated.startDateTime,
      endDateTime: validated.endDateTime,
      kind: AvailabilityKind.BLOCKED,
    },
    select: { id: true },
  });
  return { ok: true, blockId: created.id };
}

export async function clearAvailabilityWith(
  deps: AvailabilityDeps,
  input: { blockId: string },
): Promise<ClearResult> {
  const parsed = clearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const block = await deps.prisma.availabilityBlock.findUnique({
    where: { id: parsed.data.blockId },
    select: {
      id: true,
      instructorId: true,
      startDateTime: true,
      endDateTime: true,
    },
  });
  if (!block) return { ok: false, error: "NOT_FOUND" };
  if (block.instructorId !== deps.instructorId) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const bookings = (await deps.prisma.booking.findMany({
    where: {
      instructorId: deps.instructorId,
      status: { in: [...OCCUPYING_BOOKING_STATUSES] },
      date: { gte: startOfUtcDay(block.startDateTime) },
    },
    select: { id: true, date: true, anchorTime: true, duration: true, status: true },
  })) as BookingInterval[];

  if (blockOverlapsBookings(block, bookings)) {
    return { ok: false, error: "HAS_BOOKINGS" };
  }

  await deps.prisma.availabilityBlock.delete({ where: { id: block.id } });
  return { ok: true };
}
