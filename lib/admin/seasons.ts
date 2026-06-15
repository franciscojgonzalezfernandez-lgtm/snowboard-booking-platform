import { BookingStatus } from "@prisma/client";

import type { Db } from "@/lib/db";
import { assertSeasonPricesComplete } from "@/lib/pricing/get-price";
import { seasonInputSchema, type SeasonInput } from "@/lib/schemas/season";

// Pure, dependency-injected cores for the season management admin UI (F-088).
// They live in `lib/` (not the `"use server"` module in `app/`) so Vitest can
// drive them with a fake Prisma; the thin wrappers in `app/admin/actions.ts`
// gate on `requireAdmin()` + revalidate around them.
//
// No new table or migration — `Season` (F-020) already has every field. The
// product resolves "the active season" with `findFirst({ where:{ active:true }})`
// across the booking engine, pricing (F-080) and instructor availability, so the
// "exactly one active" invariant is enforced atomically in `activateSeason`.

/** "YYYY-MM-DD" → Date at UTC midnight, matching Prisma `@db.Date` storage. */
function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Date (`@db.Date`) → "YYYY-MM-DD" for display, read in UTC. */
function utcDateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type AdminSeasonsDeps = {
  prisma: Db;
};

export type SeasonListRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
  anchorTimes: string[];
  operatingHoursStart: string;
  operatingHoursEnd: string;
  /** True when all four Duration keys carry a valid price (activatable). */
  pricingComplete: boolean;
};

export async function listSeasonsWith(
  deps: AdminSeasonsDeps,
): Promise<SeasonListRow[]> {
  const seasons = await deps.prisma.season.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      active: true,
      anchorTimes: true,
      operatingHoursStart: true,
      operatingHoursEnd: true,
      priceCentsByDuration: true,
    },
  });

  return seasons.map((s) => {
    let pricingComplete = true;
    try {
      assertSeasonPricesComplete({
        id: s.id,
        priceCentsByDuration: s.priceCentsByDuration,
      });
    } catch {
      pricingComplete = false;
    }
    return {
      id: s.id,
      name: s.name,
      startDate: utcDateToIso(s.startDate),
      endDate: utcDateToIso(s.endDate),
      active: s.active,
      anchorTimes: s.anchorTimes,
      operatingHoursStart: s.operatingHoursStart,
      operatingHoursEnd: s.operatingHoursEnd,
      pricingComplete,
    };
  });
}

export type CreateSeasonResult =
  | { ok: true; id: string }
  | { ok: false; error: "INVALID_INPUT" };

export async function createSeasonWith(
  deps: AdminSeasonsDeps,
  input: SeasonInput,
): Promise<CreateSeasonResult> {
  const parsed = seasonInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const created = await deps.prisma.season.create({
    data: {
      name: parsed.data.name,
      startDate: isoToUtcDate(parsed.data.startDate),
      endDate: isoToUtcDate(parsed.data.endDate),
      anchorTimes: parsed.data.anchorTimes,
      operatingHoursStart: parsed.data.operatingHoursStart,
      operatingHoursEnd: parsed.data.operatingHoursEnd,
      // Always inactive on create. Activation runs through `activateSeason`,
      // which enforces complete pricing + the single-active invariant — a new
      // season's `priceCentsByDuration` starts `{}` so it could not be active
      // anyway. `priceCentsByDuration` defaults to `{}` in the schema.
      active: false,
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

export type UpdateSeasonResult =
  | { ok: true }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND" | "HAS_BOOKINGS_OUT_OF_RANGE";
    };

// Statuses whose bookings are "live" and would be orphaned by narrowing a
// season's date range or dropping an anchor they sit on.
const LIVE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING_PAYMENT,
];

export async function updateSeasonWith(
  deps: AdminSeasonsDeps,
  id: string,
  input: SeasonInput,
): Promise<UpdateSeasonResult> {
  const parsed = seasonInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const existing = await deps.prisma.season.findUnique({
    where: { id },
    select: { startDate: true, endDate: true },
  });
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  const newStart = isoToUtcDate(parsed.data.startDate);
  const newEnd = isoToUtcDate(parsed.data.endDate);
  const newAnchors = new Set(parsed.data.anchorTimes);

  // `Booking` has no `seasonId` FK, so we treat the bookings the season
  // currently covers (date within its OLD range) as "this season's". Reject the
  // edit if any live booking would fall outside the new range or land on an
  // anchor the new config removed — never orphan a confirmed/pending class.
  const covered = await deps.prisma.booking.findMany({
    where: {
      status: { in: LIVE_STATUSES },
      date: { gte: existing.startDate, lte: existing.endDate },
    },
    select: { date: true, anchorTime: true },
  });

  const orphaned = covered.some(
    (b) =>
      b.date < newStart ||
      b.date > newEnd ||
      !newAnchors.has(b.anchorTime),
  );
  if (orphaned) return { ok: false, error: "HAS_BOOKINGS_OUT_OF_RANGE" };

  await deps.prisma.season.update({
    where: { id },
    data: {
      name: parsed.data.name,
      startDate: newStart,
      endDate: newEnd,
      anchorTimes: parsed.data.anchorTimes,
      operatingHoursStart: parsed.data.operatingHoursStart,
      operatingHoursEnd: parsed.data.operatingHoursEnd,
      // `active` and `priceCentsByDuration` are owned by activate/deactivate
      // and the pricing editor respectively — never touched here.
    },
  });

  return { ok: true };
}

export type ActivateSeasonResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "INCOMPLETE_PRICING" };

export async function activateSeasonWith(
  deps: AdminSeasonsDeps,
  id: string,
): Promise<ActivateSeasonResult> {
  const season = await deps.prisma.season.findUnique({
    where: { id },
    select: { id: true, priceCentsByDuration: true },
  });
  if (!season) return { ok: false, error: "NOT_FOUND" };

  // Fail fast: an active season MUST carry all four Duration prices, otherwise
  // `getPriceCents` throws at booking time (F-039 invariant).
  try {
    assertSeasonPricesComplete({
      id: season.id,
      priceCentsByDuration: season.priceCentsByDuration,
    });
  } catch {
    return { ok: false, error: "INCOMPLETE_PRICING" };
  }

  // Atomic single-active invariant: every other season → inactive, target →
  // active. Without the transaction, a concurrent activate could leave two
  // active rows and make `findFirst({where:{active:true}})` non-deterministic.
  await deps.prisma.$transaction([
    deps.prisma.season.updateMany({
      where: { id: { not: id } },
      data: { active: false },
    }),
    deps.prisma.season.update({
      where: { id },
      data: { active: true },
    }),
  ]);

  return { ok: true };
}

export type DeactivateSeasonResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" };

export async function deactivateSeasonWith(
  deps: AdminSeasonsDeps,
  id: string,
): Promise<DeactivateSeasonResult> {
  const season = await deps.prisma.season.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!season) return { ok: false, error: "NOT_FOUND" };

  // Leaving zero active seasons is allowed (off-season). The booking engine
  // already degrades to "out of season" when none is active (F-022).
  await deps.prisma.season.update({
    where: { id },
    data: { active: false },
  });

  return { ok: true };
}
