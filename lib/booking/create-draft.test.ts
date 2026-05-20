import { describe, expect, test, vi } from "vitest";
import {
  AvailabilityKind,
  BookingStatus,
  Duration,
  Level,
  Locale,
} from "@prisma/client";

import { createBookingDraftWith, type CreateDraftDeps } from "./create-draft";
import type { CreateBookingDraftInput } from "@/lib/schemas/booking-draft";

const FIXED_NOW = new Date("2026-12-04T08:00:00.000Z");
const TARGET_DAY = new Date("2026-12-05T00:00:00.000Z");

const INSTRUCTOR_ID = "instr_javi";

const VALID_INPUT: CreateBookingDraftInput = {
  date: "2026-12-05",
  time: "11:00",
  duration: Duration.ONE_HOUR,
  instructorId: INSTRUCTOR_ID,
  language: Locale.en,
  bookerName: "Javi",
  bookerPhone: "+41766381870",
  attendees: [{ name: "Javi", age: 30, level: Level.INTERMEDIATE }],
  notes: "",
  acceptedTerms: true,
};

function makeEnginePrisma() {
  const season = {
    id: "season_2627",
    name: "Season 26/27",
    startDate: new Date("2026-11-15T00:00:00.000Z"),
    endDate: new Date("2027-04-30T00:00:00.000Z"),
    active: true,
    anchorTimes: [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
    ],
    operatingHoursStart: "08:00",
    operatingHoursEnd: "17:00",
  };
  const instructor = {
    id: INSTRUCTOR_ID,
    active: true,
    acceptsSameDayIfBooked: false,
    languages: [Locale.en, Locale.de],
    photo: null,
    specialties: ["freestyle"],
    user: { name: "Javi" },
  };
  const availabilityBlock = {
    instructorId: INSTRUCTOR_ID,
    startDateTime: new Date("2026-12-05T08:00:00.000Z"),
    endDateTime: new Date("2026-12-05T17:00:00.000Z"),
    kind: AvailabilityKind.AVAILABLE,
  };

  return {
    season: { findFirst: vi.fn(async () => season) },
    instructor: { findMany: vi.fn(async () => [instructor]) },
    availabilityBlock: {
      findMany: vi.fn(async () => [availabilityBlock]),
    },
    booking: { findMany: vi.fn(async () => []) },
  };
}

function makeDeps(overrides?: {
  session?: CreateDraftDeps["session"];
  existingBooking?: {
    id: string;
    stripePaymentIntentId: string | null;
    totalPriceCents: number;
  } | null;
  priceCentsByDuration?: Record<Duration, number> | unknown;
  stripeCreateError?: Error;
  retrieveSecret?: string;
}) {
  const created: Array<{ id: string; data: unknown }> = [];
  const updates: Array<{ id: string; stripePaymentIntentId: string }> = [];
  const attendeesCreated: unknown[] = [];

  const bookingCreate = vi.fn(async (args: { data: unknown }) => {
    const id = `book_${created.length + 1}`;
    created.push({ id, data: args.data });
    return { id };
  });
  const attendeeCreateMany = vi.fn(async (args: { data: unknown[] }) => {
    attendeesCreated.push(...args.data);
    return { count: args.data.length };
  });
  const bookingFindFirst = vi.fn(async () => overrides?.existingBooking ?? null);
  const bookingUpdate = vi.fn(
    async (args: {
      where: { id: string };
      data: { stripePaymentIntentId: string };
    }) => {
      updates.push({
        id: args.where.id,
        stripePaymentIntentId: args.data.stripePaymentIntentId,
      });
      return { id: args.where.id };
    },
  );
  const seasonFindFirst = vi.fn(async () => ({
    id: "season_2627",
    priceCentsByDuration:
      overrides?.priceCentsByDuration ??
      ({
        [Duration.ONE_HOUR]: 11000,
        [Duration.TWO_HOURS]: 20000,
        [Duration.INTENSIVE]: 38500,
        [Duration.FULL_DAY]: 50000,
      } satisfies Record<Duration, number>),
  }));

  const prisma = {
    season: { findFirst: seasonFindFirst },
    booking: {
      findFirst: bookingFindFirst,
      update: bookingUpdate,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        booking: { create: bookingCreate },
        attendee: { createMany: attendeeCreateMany },
      }),
    ),
  } as unknown as CreateDraftDeps["prisma"];

  const paymentIntentCreate = overrides?.stripeCreateError
    ? vi.fn(async () => {
        throw overrides.stripeCreateError;
      })
    : vi.fn(async () => ({
        id: "pi_test_123",
        client_secret: "pi_test_123_secret_abc",
      }));
  const paymentIntentRetrieve = vi.fn(async (id: string) => ({
    id,
    client_secret: overrides?.retrieveSecret ?? "pi_test_existing_secret",
  }));

  const stripe = {
    paymentIntents: {
      create: paymentIntentCreate,
      retrieve: paymentIntentRetrieve,
    },
  } as unknown as CreateDraftDeps["stripe"];

  const deps: CreateDraftDeps = {
    session:
      overrides?.session === undefined
        ? { user: { id: "user_javi" } }
        : overrides.session,
    prisma,
    stripe,
    now: FIXED_NOW,
    newIcsUid: () => "booking-fixed-uuid@rideflumserberg.ch",
  };

  return {
    deps,
    enginePrisma: makeEnginePrisma() as unknown as Parameters<
      typeof createBookingDraftWith
    >[1],
    created,
    updates,
    attendeesCreated,
    spies: {
      bookingCreate,
      attendeeCreateMany,
      bookingFindFirst,
      bookingUpdate,
      seasonFindFirst,
      paymentIntentCreate,
      paymentIntentRetrieve,
    },
  };
}

void TARGET_DAY;

describe("createBookingDraftWith — happy path", () => {
  test("creates a booking + attendee + Stripe PaymentIntent and returns the client secret", async () => {
    const { deps, enginePrisma, spies, updates, attendeesCreated } = makeDeps();

    const result = await createBookingDraftWith(deps, enginePrisma, VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookingId).toBe("book_1");
    expect(result.clientSecret).toBe("pi_test_123_secret_abc");
    expect(result.totalPriceCents).toBe(11000);
    expect(result.reused).toBe(false);

    expect(spies.bookingCreate).toHaveBeenCalledTimes(1);
    expect(spies.attendeeCreateMany).toHaveBeenCalledTimes(1);
    expect(attendeesCreated).toHaveLength(1);
    const attendee = attendeesCreated[0] as {
      isBooker: boolean;
      name: string;
      level: Level;
    };
    expect(attendee.isBooker).toBe(true);
    expect(attendee.name).toBe("Javi");
    expect(attendee.level).toBe(Level.INTERMEDIATE);

    expect(spies.paymentIntentCreate).toHaveBeenCalledTimes(1);
    const call = spies.paymentIntentCreate.mock.calls[0] as
      | [
          Parameters<CreateDraftDeps["stripe"]["paymentIntents"]["create"]>[0],
          Parameters<CreateDraftDeps["stripe"]["paymentIntents"]["create"]>[1]?,
        ]
      | undefined;
    expect(call).toBeDefined();
    const [piArgs, piOpts] = call!;
    expect(piArgs.amount).toBe(11000);
    expect(piArgs.currency).toBe("chf");
    expect(piArgs.automatic_payment_methods?.enabled).toBe(true);
    expect(piArgs.automatic_payment_methods?.allow_redirects).toBe("always");
    expect(piArgs.metadata?.bookingId).toBe("book_1");
    expect(piOpts?.idempotencyKey).toBe("booking-book_1");

    expect(updates).toEqual([
      { id: "book_1", stripePaymentIntentId: "pi_test_123" },
    ]);
  });

  test("price comes from Season.priceCentsByDuration matching the requested duration", async () => {
    const { deps, enginePrisma } = makeDeps({
      priceCentsByDuration: {
        [Duration.ONE_HOUR]: 11000,
        [Duration.TWO_HOURS]: 20000,
        [Duration.INTENSIVE]: 38500,
        [Duration.FULL_DAY]: 50000,
      },
    });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      duration: Duration.TWO_HOURS,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.totalPriceCents).toBe(20000);
  });
});

describe("createBookingDraftWith — authorisation + validation", () => {
  test("rejects anonymous callers with UNAUTHORIZED", async () => {
    const { deps, enginePrisma } = makeDeps({ session: null });
    const result = await createBookingDraftWith(deps, enginePrisma, VALID_INPUT);
    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  test("rejects ANYONE instructor id with INVALID_INPUT", async () => {
    const { deps, enginePrisma } = makeDeps();
    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      instructorId: "ANYONE",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_INPUT");
  });

  test("rejects attendees < 1 with INVALID_INPUT", async () => {
    const { deps, enginePrisma } = makeDeps();
    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      attendees: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_INPUT");
  });

  test("rejects attendees > 4 with INVALID_INPUT", async () => {
    const { deps, enginePrisma } = makeDeps();
    const attendees = Array.from({ length: 5 }, (_, i) => ({
      name: `Rider ${i}`,
      age: 20,
      level: Level.BEGINNER,
    }));
    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      attendees,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_INPUT");
  });

  test("rejects acceptedTerms !== true", async () => {
    const { deps, enginePrisma } = makeDeps();
    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      acceptedTerms: false as unknown as true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_INPUT");
  });

  test("rejects invalid phone", async () => {
    const { deps, enginePrisma } = makeDeps();
    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      bookerPhone: "not-a-phone",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_INPUT");
  });

  test("returns SLOT_TAKEN when the instructor no longer covers the requested anchor", async () => {
    const { deps, enginePrisma } = makeDeps();
    // Replace the availability block stub so the engine reports no coverage.
    (enginePrisma as unknown as {
      availabilityBlock: { findMany: () => Promise<unknown[]> };
    }).availabilityBlock.findMany = vi.fn(async () => []);
    const result = await createBookingDraftWith(deps, enginePrisma, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("SLOT_TAKEN");
  });

  test("returns PRICING_MISSING when the season has no entry for the duration", async () => {
    const { deps, enginePrisma } = makeDeps({
      priceCentsByDuration: {
        [Duration.TWO_HOURS]: 20000,
      },
    });
    const result = await createBookingDraftWith(deps, enginePrisma, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("PRICING_MISSING");
  });
});

describe("createBookingDraftWith — idempotency", () => {
  test("reuses an existing PENDING_PAYMENT booking within 15 minutes", async () => {
    const existing = {
      id: "book_existing",
      stripePaymentIntentId: "pi_existing",
      totalPriceCents: 11000,
    };
    const { deps, enginePrisma, spies } = makeDeps({
      existingBooking: existing,
      retrieveSecret: "pi_existing_secret_xyz",
    });

    const result = await createBookingDraftWith(deps, enginePrisma, VALID_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookingId).toBe("book_existing");
    expect(result.clientSecret).toBe("pi_existing_secret_xyz");
    expect(result.reused).toBe(true);

    expect(spies.paymentIntentRetrieve).toHaveBeenCalledWith("pi_existing");
    expect(spies.paymentIntentCreate).not.toHaveBeenCalled();
    expect(spies.bookingCreate).not.toHaveBeenCalled();
  });
});

describe("createBookingDraftWith — attendee isBooker flag", () => {
  test("only the first attendee whose name matches the booker is marked isBooker", async () => {
    const { deps, enginePrisma, attendeesCreated } = makeDeps();
    await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      bookerName: "Javi",
      attendees: [
        { name: "Lara", age: 10, level: Level.BEGINNER },
        { name: "Javi", age: 30, level: Level.INTERMEDIATE },
        { name: "Javi", age: 32, level: Level.ADVANCED },
      ],
    });
    expect(attendeesCreated).toHaveLength(3);
    const flags = (attendeesCreated as Array<{ isBooker: boolean }>).map(
      (a) => a.isBooker,
    );
    expect(flags).toEqual([false, true, false]);
  });

  test("no attendee is flagged when the booker is not riding", async () => {
    const { deps, enginePrisma, attendeesCreated } = makeDeps();
    await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      bookerName: "Javi",
      attendees: [
        { name: "Kid A", age: 6, level: Level.BEGINNER },
        { name: "Kid B", age: 8, level: Level.BEGINNER },
      ],
    });
    expect(
      (attendeesCreated as Array<{ isBooker: boolean }>).every(
        (a) => a.isBooker === false,
      ),
    ).toBe(true);
  });
});
