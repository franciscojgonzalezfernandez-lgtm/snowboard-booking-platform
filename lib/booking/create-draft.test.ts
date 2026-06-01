import { describe, expect, test, vi } from "vitest";
import {
  AvailabilityKind,
  CreditReason,
  CreditStatus,
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

type CreditFixture = {
  id: string;
  amountCents: number;
  expiresAt: Date;
  reason?: CreditReason;
  sourceBookingId?: string;
};

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
  /** F-060: PaymentIntent.amount returned by retrieve on the reused path. */
  retrieveAmount?: number;
  /** F-060: PaymentIntent.metadata returned by retrieve on the reused path. */
  retrieveMetadata?: Record<string, string>;
  /** Simulate a booker who already has a phone on file (guard won't match). */
  userHasPhone?: boolean;
  /** Force the phone backfill update to throw a transient error. */
  userUpdateError?: Error;
  /** F-060: rows accountCredit.findMany returns (already filter-matched). */
  credits?: CreditFixture[];
  /**
   * F-060: override the count returned by the guarded lock/use updateMany to
   * simulate a concurrent draft grabbing a credit between read and write.
   */
  lockCountOverride?: number;
}) {
  const created: Array<{ id: string; data: unknown }> = [];
  const updates: Array<{ id: string; stripePaymentIntentId: string }> = [];
  const attendeesCreated: unknown[] = [];
  const userUpdates: Array<{ id: string; phone: string }> = [];
  const creditWrites: Array<{
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }> = [];
  const creditCreates: Array<Record<string, unknown>> = [];
  const dispatched: string[] = [];

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

  const userUpdate = vi.fn(
    async (args: { where: { id: string; phone: null }; data: { phone: string } }) => {
      if (overrides?.userUpdateError) throw overrides.userUpdateError;
      if (overrides?.userHasPhone) {
        // Mirror Prisma: `where: { phone: null }` matches no row when a phone
        // is already set, so update throws P2025 (record-not-found).
        throw Object.assign(new Error("Record to update not found."), {
          code: "P2025",
        });
      }
      userUpdates.push({ id: args.where.id, phone: args.data.phone });
      return { id: args.where.id };
    },
  );

  const creditFindMany = vi.fn(async () =>
    (overrides?.credits ?? []).map((c) => ({
      id: c.id,
      amountCents: c.amountCents,
      expiresAt: c.expiresAt,
      reason: c.reason ?? CreditReason.USER_CANCEL,
      sourceBookingId: c.sourceBookingId ?? `src_${c.id}`,
    })),
  );
  const creditUpdateMany = vi.fn(
    async (args: {
      where: { id: { in: string[] } | string } & Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      creditWrites.push({ where: args.where, data: args.data });
      // The partial-credit write targets a single id (string); the bulk
      // fully-consumed write targets `{ id: { in: [...] } }`.
      const matched =
        typeof args.where.id === "string" ? 1 : args.where.id.in.length;
      const count = overrides?.lockCountOverride ?? matched;
      return { count };
    },
  );
  const creditCreate = vi.fn(async (args: { data: Record<string, unknown> }) => {
    creditCreates.push(args.data);
    return { id: `credit_remnant_${creditCreates.length}` };
  });

  const prisma = {
    season: { findFirst: seasonFindFirst },
    booking: {
      findFirst: bookingFindFirst,
      update: bookingUpdate,
    },
    accountCredit: { findMany: creditFindMany },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        booking: { create: bookingCreate },
        attendee: { createMany: attendeeCreateMany },
        user: { update: userUpdate },
        accountCredit: { updateMany: creditUpdateMany, create: creditCreate },
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
    amount: overrides?.retrieveAmount ?? 11000,
    metadata: overrides?.retrieveMetadata ?? {},
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
    dispatchBookingConfirmedEmail: async (bookingId: string) => {
      dispatched.push(bookingId);
    },
  };

  return {
    deps,
    enginePrisma: makeEnginePrisma() as unknown as Parameters<
      typeof createBookingDraftWith
    >[1],
    created,
    updates,
    attendeesCreated,
    userUpdates,
    creditWrites,
    creditCreates,
    dispatched,
    spies: {
      bookingCreate,
      attendeeCreateMany,
      bookingFindFirst,
      bookingUpdate,
      seasonFindFirst,
      paymentIntentCreate,
      paymentIntentRetrieve,
      userUpdate,
      creditFindMany,
      creditUpdateMany,
      creditCreate,
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

  // Regression: a resubmit of the same slot must reuse the booker's own
  // in-flight draft even though that draft makes the engine report the slot
  // taken. The idempotency check runs BEFORE the availability re-check, so the
  // booker is never dead-ended on SLOT_TAKEN against their own pending booking.
  test("reuses the in-flight draft even when the engine reports the slot taken", async () => {
    const existing = {
      id: "book_existing",
      stripePaymentIntentId: "pi_existing",
      totalPriceCents: 20000,
    };
    const { deps, enginePrisma, spies } = makeDeps({
      existingBooking: existing,
      retrieveSecret: "pi_existing_secret_xyz",
    });
    // The slot now reads as fully unavailable (their own PENDING booking holds
    // it). Pre-reorder this returned SLOT_TAKEN; now reuse short-circuits first.
    (enginePrisma as unknown as {
      availabilityBlock: { findMany: () => Promise<unknown[]> };
    }).availabilityBlock.findMany = vi.fn(async () => []);

    const result = await createBookingDraftWith(deps, enginePrisma, VALID_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(true);
    expect(result.bookingId).toBe("book_existing");
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

describe("createBookingDraftWith — phone auto-backfill (F-064a)", () => {
  test("persists the normalised bookerPhone when the user has no phone on file", async () => {
    const { deps, enginePrisma, spies, userUpdates } = makeDeps();

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      // Spaces must be stripped before the value reaches User.phone.
      bookerPhone: "+41 76 111 22 33",
    });

    expect(result.ok).toBe(true);
    expect(spies.userUpdate).toHaveBeenCalledTimes(1);
    const call = spies.userUpdate.mock.calls[0]![0];
    expect(call.where).toEqual({ id: "user_javi", phone: null });
    expect(userUpdates).toEqual([{ id: "user_javi", phone: "+41761112233" }]);
  });

  test("does not overwrite an existing phone (guard matches no row)", async () => {
    const { deps, enginePrisma, spies, userUpdates } = makeDeps({
      userHasPhone: true,
    });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      bookerPhone: "+41760000000",
    });

    // The booking still succeeds; the no-match update was swallowed.
    expect(result.ok).toBe(true);
    expect(spies.bookingCreate).toHaveBeenCalledTimes(1);
    expect(spies.userUpdate).toHaveBeenCalledTimes(1);
    expect(userUpdates).toEqual([]);
  });

  test("a failing backfill never rolls back the booking (best-effort)", async () => {
    const { deps, enginePrisma, spies } = makeDeps({
      userUpdateError: new Error("connection reset"),
    });

    const result = await createBookingDraftWith(deps, enginePrisma, VALID_INPUT);

    // Transaction completed and the Stripe PaymentIntent was still created.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.clientSecret).toBe("pi_test_123_secret_abc");
    expect(spies.bookingCreate).toHaveBeenCalledTimes(1);
    expect(spies.paymentIntentCreate).toHaveBeenCalledTimes(1);
  });
});

describe("createBookingDraftWith — F-060 credit redemption", () => {
  const C_EARLY = new Date("2026-12-10T00:00:00.000Z");
  const C_LATE = new Date("2026-12-31T00:00:00.000Z");

  test("no creditIds → credit lookup is skipped, full price is charged", async () => {
    const { deps, enginePrisma, spies } = makeDeps();
    const result = await createBookingDraftWith(deps, enginePrisma, VALID_INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chargeAmountCents).toBe(11000);
      expect(result.creditsAppliedCents).toBe(0);
    }
    expect(spies.creditFindMany).not.toHaveBeenCalled();
  });

  test("happy partial: one credit discounts the charge, credit is LOCKED, metadata carries the ids", async () => {
    const { deps, enginePrisma, spies, creditWrites } = makeDeps({
      credits: [{ id: "cr1", amountCents: 5000, expiresAt: C_LATE }],
    });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      creditIds: ["cr1"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chargeAmountCents).toBe(6000);
    expect(result.creditsAppliedCents).toBe(5000);
    expect(result.clientSecret).toBe("pi_test_123_secret_abc");

    // PaymentIntent charges the discounted amount and tags the locked credits.
    const [piArgs] = spies.paymentIntentCreate.mock.calls[0] as unknown as [
      { amount: number; metadata?: Record<string, string> },
    ];
    expect(piArgs.amount).toBe(6000);
    expect(piArgs.metadata?.creditsAppliedCents).toBe("5000");
    expect(piArgs.metadata?.lockedCreditIds).toBe("cr1");

    // F-084: the net charge + applied credits are persisted on the Booking so
    // the resume-payment flow bills the right amount without re-reading Stripe.
    const [bookingArgs] = spies.bookingCreate.mock.calls[0] as unknown as [
      { data: { chargeAmountCents: number; creditsAppliedCents: number } },
    ];
    expect(bookingArgs.data.chargeAmountCents).toBe(6000);
    expect(bookingArgs.data.creditsAppliedCents).toBe(5000);

    // Credit moves ACTIVE → LOCKED (settled later by the webhook).
    expect(creditWrites).toHaveLength(1);
    expect(creditWrites[0]!.data).toMatchObject({ status: CreditStatus.LOCKED });
    expect((creditWrites[0]!.where as { id: { in: string[] } }).id.in).toEqual(["cr1"]);
  });

  test("happy full (zero-charge): credits fully cover the lesson → CONFIRMED, no PaymentIntent, email dispatched", async () => {
    const { deps, enginePrisma, spies, created, creditWrites, dispatched } =
      makeDeps({
        credits: [{ id: "cr1", amountCents: 11000, expiresAt: C_LATE }],
      });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      creditIds: ["cr1"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chargeAmountCents).toBe(0);
    expect(result.creditsAppliedCents).toBe(11000);
    expect(result.clientSecret).toBeNull();

    // Booking is created CONFIRMED + paidAt; no Stripe call at all.
    const createData = created[0]!.data as { status: string; paidAt?: Date };
    expect(createData.status).toBe("CONFIRMED");
    expect(createData.paidAt).toBeInstanceOf(Date);
    expect(spies.paymentIntentCreate).not.toHaveBeenCalled();

    // Credits flip straight to USED, and the confirmation email is dispatched here.
    expect(creditWrites[0]!.data).toMatchObject({
      status: CreditStatus.USED,
      usedOnBookingId: created[0]!.id,
    });
    expect(dispatched).toEqual([created[0]!.id]);
  });

  test("oldest-first cap: only the earliest-expiring credits up to coverage are consumed", async () => {
    // Sorted by expiry asc: cr_early (11000) covers the full 11000 alone, so
    // cr_late is left untouched (ACTIVE).
    const { deps, enginePrisma, creditWrites } = makeDeps({
      credits: [
        { id: "cr_late", amountCents: 5000, expiresAt: C_LATE },
        { id: "cr_early", amountCents: 11000, expiresAt: C_EARLY },
      ],
    });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      creditIds: ["cr_late", "cr_early"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.creditsAppliedCents).toBe(11000);
    expect((creditWrites[0]!.where as { id: { in: string[] } }).id.in).toEqual([
      "cr_early",
    ]);
  });

  test("partial-use: the credit crossing the price is split — applied portion consumed, remainder re-issued (same expiry + provenance)", async () => {
    // Sorted by expiry asc on an 11000 lesson:
    //   cr1 (5000, 12-08) full → covered 5000
    //   cr2 (5000, 12-10) full → covered 10000
    //   cr3 (5000, 12-31) crosses → apply 1000, re-issue 4000 remnant
    const { deps, enginePrisma, created, creditWrites, creditCreates } =
      makeDeps({
        credits: [
          {
            id: "cr1",
            amountCents: 5000,
            expiresAt: new Date("2026-12-08T00:00:00.000Z"),
          },
          { id: "cr2", amountCents: 5000, expiresAt: C_EARLY },
          {
            id: "cr3",
            amountCents: 5000,
            expiresAt: C_LATE,
            reason: CreditReason.OPS_CANCEL,
            sourceBookingId: "src_origin",
          },
        ],
      });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      creditIds: ["cr1", "cr2", "cr3"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Capped exactly at the price — no overshoot, no lost value.
      expect(result.creditsAppliedCents).toBe(11000);
      expect(result.chargeAmountCents).toBe(0);
    }
    // No overshoot annotation anymore.
    const createData = created[0]!.data as { notes: string | null };
    expect(createData.notes).toBeNull();

    // Two fully-consumed credits flip to USED in one bulk write…
    const bulk = creditWrites.find(
      (w) => typeof (w.where as { id: unknown }).id === "object",
    );
    expect((bulk!.where as { id: { in: string[] } }).id.in).toEqual([
      "cr1",
      "cr2",
    ]);
    expect(bulk!.data).toMatchObject({ status: CreditStatus.USED });

    // …and the crossing credit is rewritten down to the applied portion.
    const partial = creditWrites.find(
      (w) => typeof (w.where as { id: unknown }).id === "string",
    );
    expect((partial!.where as { id: string }).id).toBe("cr3");
    expect(partial!.data).toMatchObject({
      status: CreditStatus.USED,
      amountCents: 1000,
      usedOnBookingId: created[0]!.id,
    });

    // The 4000 remainder is re-issued ACTIVE, same expiry + inherited provenance.
    expect(creditCreates).toHaveLength(1);
    expect(creditCreates[0]).toMatchObject({
      userId: "user_javi",
      amountCents: 4000,
      status: CreditStatus.ACTIVE,
      expiresAt: C_LATE,
      reason: CreditReason.OPS_CANCEL,
      sourceBookingId: "src_origin",
    });
  });

  test("exact coverage: a credit equal to the remaining balance is fully consumed with no remnant", async () => {
    const { deps, enginePrisma, creditCreates, spies } = makeDeps({
      // 6000 + 5000 == 11000 exactly → both full, nothing split.
      credits: [
        { id: "cr_a", amountCents: 6000, expiresAt: C_EARLY },
        { id: "cr_b", amountCents: 5000, expiresAt: C_LATE },
      ],
    });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      creditIds: ["cr_a", "cr_b"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.creditsAppliedCents).toBe(11000);
      expect(result.chargeAmountCents).toBe(0);
    }
    expect(creditCreates).toHaveLength(0);
    expect(spies.creditCreate).not.toHaveBeenCalled();
  });

  test("rejects with CREDIT_NOT_APPLICABLE when a selected credit is not returned (expired / used / locked / not owned)", async () => {
    // Two ids requested, but the filtered lookup only returns one — the other
    // failed the userId / status: ACTIVE / expiresAt > now guard.
    const { deps, enginePrisma, spies } = makeDeps({
      credits: [{ id: "cr_ok", amountCents: 5000, expiresAt: C_LATE }],
    });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      creditIds: ["cr_ok", "cr_bad"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("CREDIT_NOT_APPLICABLE");
    expect(spies.bookingCreate).not.toHaveBeenCalled();
    expect(spies.paymentIntentCreate).not.toHaveBeenCalled();
  });

  test("race double-lock: guarded write matches fewer rows than selected → CREDIT_NOT_APPLICABLE, no PaymentIntent", async () => {
    const { deps, enginePrisma, spies } = makeDeps({
      credits: [{ id: "cr1", amountCents: 5000, expiresAt: C_LATE }],
      // Concurrent draft grabbed cr1 between the read and the guarded write.
      lockCountOverride: 0,
    });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      creditIds: ["cr1"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("CREDIT_NOT_APPLICABLE");
    expect(spies.paymentIntentCreate).not.toHaveBeenCalled();
  });

  test("reused draft reports the charge + credits from the existing PaymentIntent, not the new selection", async () => {
    const { deps, enginePrisma } = makeDeps({
      existingBooking: {
        id: "book_existing",
        stripePaymentIntentId: "pi_existing",
        totalPriceCents: 11000,
      },
      retrieveSecret: "pi_existing_secret",
      retrieveAmount: 6000,
      retrieveMetadata: { creditsAppliedCents: "5000" },
    });

    const result = await createBookingDraftWith(deps, enginePrisma, {
      ...VALID_INPUT,
      creditIds: ["cr1"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(true);
    expect(result.chargeAmountCents).toBe(6000);
    expect(result.creditsAppliedCents).toBe(5000);
  });
});
