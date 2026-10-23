import { describe, expect, test } from "vitest";
import { BookingStatus, Duration, Locale } from "@prisma/client";

import {
  rescheduleBookingWith,
  type RescheduleBookingDeps,
} from "./reschedule";
import {
  JAVI,
  SEASON,
  fullDayAvailability,
  weekAvailability,
} from "@/lib/booking-engine/fixtures";
import type {
  EngineAvailabilityBlock,
  EngineBooking,
} from "@/lib/booking-engine/types";

const NOW = new Date("2026-12-01T08:00:00.000Z");
const OWNER = "user_owner";

// Shape the reschedule core selects from `booking.findUnique`.
type MovingBooking = {
  id: string;
  bookerId: string;
  status: BookingStatus;
  date: Date;
  anchorTime: string;
  duration: Duration;
  instructorId: string;
  originalDate: Date | null;
};

function makeBooking(overrides: Partial<MovingBooking> = {}): MovingBooking {
  return {
    id: "book_1",
    bookerId: OWNER,
    status: BookingStatus.CONFIRMED,
    // 10 days out from NOW → comfortably ≥48h before start.
    date: new Date("2026-12-11T00:00:00.000Z"),
    anchorTime: "09:00",
    duration: Duration.ONE_HOUR,
    instructorId: JAVI.id,
    originalDate: null,
    ...overrides,
  };
}

type DepsResult = {
  deps: RescheduleBookingDeps;
  updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>;
};

function makeDeps(opts: {
  booking: MovingBooking | null;
  session?: { user: { id: string } } | null;
  now?: Date;
  /** Engine occupancy returned by `booking.findMany` (default none). */
  engineBookings?: EngineBooking[];
  /** Availability blocks for the engine (default a week of full availability). */
  blocks?: EngineAvailabilityBlock[];
  /** Active season the engine sees (default the shared SEASON fixture). */
  season?: typeof SEASON;
  /** Rows `updateMany` reports it changed — 0 simulates a lost race. */
  updateCount?: number;
}): DepsResult {
  const updates: DepsResult["updates"] = [];
  const blocks =
    opts.blocks ??
    weekAvailability(JAVI.id, new Date("2026-12-08T00:00:00.000Z"));
  const engineBookings = opts.engineBookings ?? [];
  const season = opts.season ?? SEASON;
  const updateCount = opts.updateCount ?? 1;

  const fake = {
    booking: {
      findUnique: async () => opts.booking,
      findMany: async () => engineBookings,
      updateMany: async (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        updates.push(args);
        return { count: updateCount };
      },
    },
    season: { findFirst: async () => season },
    instructor: {
      findMany: async () => [
        {
          id: JAVI.id,
          active: JAVI.active,
          acceptsSameDayIfBooked: JAVI.acceptsSameDayIfBooked,
          languages: JAVI.languages as Locale[],
          photo: JAVI.photo ?? null,
          specialties: JAVI.specialties ?? [],
          user: { name: JAVI.name ?? null },
        },
      ],
    },
    availabilityBlock: { findMany: async () => blocks },
  };

  return {
    deps: {
      session: opts.session === undefined ? { user: { id: OWNER } } : opts.session,
      // The fake stands in for both the policy client and the engine client.
      prisma: fake as unknown as RescheduleBookingDeps["prisma"],
      enginePrisma: fake as unknown as RescheduleBookingDeps["enginePrisma"],
      now: opts.now ?? NOW,
    },
    updates,
  };
}

// A new, free slot the default booking can move to: next day, 10:00, same
// instructor. Inside the season, operating hours and full availability.
const NEW_DATE = "2026-12-12";
const NEW_TIME = "10:00";

describe("rescheduleBookingWith", () => {
  test("moves a confirmed booking and touches no money fields", async () => {
    const { deps, updates } = makeDeps({ booking: makeBooking() });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: NEW_DATE,
      newAnchorTime: NEW_TIME,
      newInstructorId: JAVI.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newAnchorTime).toBe(NEW_TIME);
    expect(result.newDate.toISOString().slice(0, 10)).toBe(NEW_DATE);
    expect(result.oldAnchorTime).toBe("09:00");

    expect(updates).toHaveLength(1);
    const { where, data } = updates[0]!;
    // Guarded on CONFIRMED for concurrency safety.
    expect(where).toMatchObject({ id: "book_1", status: BookingStatus.CONFIRMED });
    expect(data.anchorTime).toBe(NEW_TIME);
    expect(data.instructorId).toBe(JAVI.id);
    // First move sets the horizon anchor to the pre-move date.
    expect((data.originalDate as Date).toISOString().slice(0, 10)).toBe(
      "2026-12-11",
    );
    expect(data.rescheduleCount).toEqual({ increment: 1 });
    // Critically: no price / credit / discount field is written.
    for (const key of [
      "totalPriceCents",
      "chargeAmountCents",
      "creditsAppliedCents",
      "discountCents",
      "originalPriceCents",
      "status",
    ]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  test("keeps the ORIGINAL anchor across a second move (horizon doesn't reset)", async () => {
    // Already moved once: originalDate is a year-ago date, so its +1y horizon
    // has nearly elapsed. A move just past it must be rejected even though the
    // current lesson date is far in the future.
    const { deps } = makeDeps({
      booking: makeBooking({
        originalDate: new Date("2026-01-05T00:00:00.000Z"),
      }),
    });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: "2027-01-06", // 2026-01-05 + 1y = 2027-01-05 → one day past
      newAnchorTime: NEW_TIME,
      newInstructorId: JAVI.id,
    });

    expect(result).toEqual({ ok: false, error: "OUTSIDE_HORIZON" });
  });

  test("allows a move exactly one year after the anchor", async () => {
    const { deps } = makeDeps({
      booking: makeBooking({
        originalDate: new Date("2026-12-11T00:00:00.000Z"),
      }),
      // A season long enough that the horizon (not the season) is the binding
      // constraint, plus availability on the horizon day itself.
      season: { ...SEASON, endDate: new Date("2028-04-30T00:00:00.000Z") },
      blocks: [
        fullDayAvailability(JAVI.id, new Date("2027-12-11T00:00:00.000Z")),
      ],
    });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: "2027-12-11",
      newAnchorTime: NEW_TIME,
      newInstructorId: JAVI.id,
    });

    expect(result.ok).toBe(true);
  });

  test("rejects a move inside the 48h window", async () => {
    const { deps } = makeDeps({
      booking: makeBooking({
        // ~25h before start at NOW.
        date: new Date("2026-12-02T00:00:00.000Z"),
        anchorTime: "09:00",
      }),
    });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: NEW_DATE,
      newAnchorTime: NEW_TIME,
      newInstructorId: JAVI.id,
    });

    expect(result).toEqual({ ok: false, error: "TOO_LATE" });
  });

  test("rejects a no-op move to the identical slot", async () => {
    const { deps } = makeDeps({ booking: makeBooking() });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: "2026-12-11",
      newAnchorTime: "09:00",
      newInstructorId: JAVI.id,
    });

    expect(result).toEqual({ ok: false, error: "SAME_SLOT" });
  });

  test("returns SLOT_TAKEN when the new slot has no availability", async () => {
    const { deps } = makeDeps({ booking: makeBooking(), blocks: [] });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: NEW_DATE,
      newAnchorTime: NEW_TIME,
      newInstructorId: JAVI.id,
    });

    expect(result).toEqual({ ok: false, error: "SLOT_TAKEN" });
  });

  test("excludes the booking from its own occupancy (self-overlap allowed)", async () => {
    // A 4h lesson at 09:00 (09–13) moved to 11:00 (11–15) the same day overlaps
    // its OWN current time. Only itself occupies that window, so the move is
    // allowed — the engine must not treat the booking as colliding with itself.
    const booking = makeBooking({ duration: Duration.INTENSIVE });
    const { deps } = makeDeps({
      booking,
      engineBookings: [
        {
          id: "book_1",
          instructorId: JAVI.id,
          date: new Date("2026-12-11T00:00:00.000Z"),
          anchorTime: "09:00",
          duration: Duration.INTENSIVE,
          status: BookingStatus.CONFIRMED,
        },
      ],
    });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: "2026-12-11",
      newAnchorTime: "11:00",
      newInstructorId: JAVI.id,
    });

    expect(result.ok).toBe(true);
  });

  test("still detects a collision with a DIFFERENT booking", async () => {
    const booking = makeBooking({ duration: Duration.INTENSIVE });
    const { deps } = makeDeps({
      booking,
      engineBookings: [
        // Someone else's lesson on the target day overlaps 11:00–15:00.
        {
          id: "book_other",
          instructorId: JAVI.id,
          date: new Date("2026-12-11T00:00:00.000Z"),
          anchorTime: "12:00",
          duration: Duration.ONE_HOUR,
          status: BookingStatus.CONFIRMED,
        },
      ],
    });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: "2026-12-11",
      newAnchorTime: "11:00",
      newInstructorId: JAVI.id,
    });

    expect(result).toEqual({ ok: false, error: "SLOT_TAKEN" });
  });

  test("maps a lost race (0 rows updated) to NOT_RESCHEDULABLE", async () => {
    const { deps } = makeDeps({ booking: makeBooking(), updateCount: 0 });

    const result = await rescheduleBookingWith(deps, {
      bookingId: "book_1",
      newDate: NEW_DATE,
      newAnchorTime: NEW_TIME,
      newInstructorId: JAVI.id,
    });

    expect(result).toEqual({ ok: false, error: "NOT_RESCHEDULABLE" });
  });

  test("guards unauthorized / not-found / forbidden / wrong-status", async () => {
    const unauth = makeDeps({ booking: makeBooking(), session: null });
    expect(
      await rescheduleBookingWith(unauth.deps, {
        bookingId: "book_1",
        newDate: NEW_DATE,
        newAnchorTime: NEW_TIME,
        newInstructorId: JAVI.id,
      }),
    ).toEqual({ ok: false, error: "UNAUTHORIZED" });

    const missing = makeDeps({ booking: null });
    expect(
      await rescheduleBookingWith(missing.deps, {
        bookingId: "book_1",
        newDate: NEW_DATE,
        newAnchorTime: NEW_TIME,
        newInstructorId: JAVI.id,
      }),
    ).toEqual({ ok: false, error: "NOT_FOUND" });

    const foreign = makeDeps({
      booking: makeBooking({ bookerId: "someone_else" }),
    });
    expect(
      await rescheduleBookingWith(foreign.deps, {
        bookingId: "book_1",
        newDate: NEW_DATE,
        newAnchorTime: NEW_TIME,
        newInstructorId: JAVI.id,
      }),
    ).toEqual({ ok: false, error: "FORBIDDEN" });

    const cancelled = makeDeps({
      booking: makeBooking({ status: BookingStatus.CANCELLED_BY_USER }),
    });
    expect(
      await rescheduleBookingWith(cancelled.deps, {
        bookingId: "book_1",
        newDate: NEW_DATE,
        newAnchorTime: NEW_TIME,
        newInstructorId: JAVI.id,
      }),
    ).toEqual({ ok: false, error: "NOT_RESCHEDULABLE" });
  });
});
