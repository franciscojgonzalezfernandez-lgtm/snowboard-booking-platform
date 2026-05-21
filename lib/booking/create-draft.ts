import { randomUUID } from "crypto";

import { BookingStatus, type Duration } from "@prisma/client";
import type Stripe from "stripe";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { instructorAvailableAt } from "@/lib/booking-engine/availability";
import { loadEngineContext } from "@/lib/booking-engine/load-context";
import { setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";
import { PriceConfigurationError, getPriceCents } from "@/lib/pricing/get-price";
import {
  createBookingDraftSchema,
  type CreateBookingDraftInput,
  type CreateBookingDraftResult,
  type DraftAttendeeInput,
} from "@/lib/schemas/booking-draft";

const IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000;
const ICS_DOMAIN = "rideflumserberg.ch";

export type CreateDraftDeps = {
  /** Pre-resolved session from the framework; null if anonymous. */
  session: { user: { id: string } } | null;
  /** A Prisma-like surface; constrained to the queries this action needs. */
  prisma: PrismaSurface;
  /** Stripe-like surface; mocked in tests, real Stripe SDK in production. */
  stripe: StripeSurface;
  /** Reference clock — tests inject a fixed Date, production passes new Date(). */
  now?: Date;
  /** Override the ICS UID generator so test snapshots stay stable. */
  newIcsUid?: () => string;
};

type PrismaSurface = {
  season: {
    findFirst(args: {
      where: { active: true };
      select: { id: true; priceCentsByDuration: true };
    }): Promise<{ id: string; priceCentsByDuration: unknown } | null>;
  };
  booking: {
    findFirst(args: {
      where: {
        bookerId: string;
        instructorId: string;
        date: Date;
        anchorTime: string;
        status: BookingStatus;
        createdAt: { gt: Date };
        stripePaymentIntentId: { not: null };
      };
      select: {
        id: true;
        stripePaymentIntentId: true;
        totalPriceCents: true;
      };
    }): Promise<{
      id: string;
      stripePaymentIntentId: string | null;
      totalPriceCents: number;
    } | null>;
    update(args: {
      where: { id: string };
      data: { stripePaymentIntentId: string };
    }): Promise<{ id: string }>;
  };
  $transaction<T>(
    cb: (tx: PrismaTransactionSurface) => Promise<T>,
  ): Promise<T>;
} & PrismaTransactionSurface;

type PrismaTransactionSurface = {
  booking: {
    create(args: {
      data: {
        bookerId: string;
        instructorId: string;
        date: Date;
        anchorTime: string;
        duration: Duration;
        language: string;
        status: BookingStatus;
        totalPriceCents: number;
        icsUid: string;
        notes: string | null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  attendee: {
    createMany(args: {
      data: Array<{
        bookingId: string;
        name: string;
        birthDate: Date;
        level: string;
        isBooker: boolean;
      }>;
    }): Promise<{ count: number }>;
  };
};

type StripeSurface = {
  paymentIntents: {
    create(
      params: Stripe.PaymentIntentCreateParams,
      options?: Stripe.RequestOptions,
    ): Promise<Pick<Stripe.PaymentIntent, "id" | "client_secret">>;
    retrieve(
      id: string,
    ): Promise<Pick<Stripe.PaymentIntent, "id" | "client_secret">>;
  };
};

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function approximateBirthDate(age: number, now: Date): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function buildAttendeeRows(
  attendees: DraftAttendeeInput[],
  bookerName: string,
  now: Date,
): Array<{
  name: string;
  birthDate: Date;
  level: DraftAttendeeInput["level"];
  isBooker: boolean;
}> {
  const normalisedBooker = bookerName.trim().toLowerCase();
  let bookerAssigned = false;
  return attendees.map((a) => {
    const matchesBooker =
      !bookerAssigned && a.name.trim().toLowerCase() === normalisedBooker;
    if (matchesBooker) bookerAssigned = true;
    return {
      name: a.name.trim(),
      birthDate: approximateBirthDate(a.age, now),
      level: a.level,
      isBooker: matchesBooker,
    };
  });
}

export async function createBookingDraftWith(
  deps: CreateDraftDeps,
  // The action also takes the raw Prisma client to call loadEngineContext, since
  // loading the engine context requires more shapes than PrismaSurface exposes.
  // Tests can pass any object that satisfies the loader's contract.
  enginePrisma: Parameters<typeof loadEngineContext>[0],
  input: CreateBookingDraftInput,
): Promise<CreateBookingDraftResult> {
  const { session, prisma, stripe } = deps;
  const now = deps.now ?? new Date();
  const newIcsUid = deps.newIcsUid ?? (() => `booking-${randomUUID()}@${ICS_DOMAIN}`);

  if (!session?.user) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  const parsed = createBookingDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_INPUT", issues: parsed.error.issues };
  }
  const data = parsed.data;

  const dayUtc = startOfUtcDay(dateOnly(data.date));
  const startDateTime = setUtcTime(dayUtc, data.time);
  const endDateTime = new Date(
    startDateTime.getTime() + durationMinutes(data.duration) * 60_000,
  );

  const ctx = await loadEngineContext(enginePrisma, {
    from: dayUtc,
    to: dayUtc,
    now,
  });
  if (!ctx.season) return { ok: false, error: "NO_ACTIVE_SEASON" };
  const instructor = ctx.instructors.find((i) => i.id === data.instructorId);
  if (!instructor) return { ok: false, error: "SLOT_TAKEN" };
  const available = instructorAvailableAt(ctx, {
    instructor,
    date: dayUtc,
    anchorTime: data.time,
    duration: data.duration,
  });
  if (!available) return { ok: false, error: "SLOT_TAKEN" };

  const seasonRow = await prisma.season.findFirst({
    where: { active: true },
    select: { id: true, priceCentsByDuration: true },
  });
  if (!seasonRow) return { ok: false, error: "NO_ACTIVE_SEASON" };

  let totalPriceCents: number;
  try {
    totalPriceCents = getPriceCents(
      // The pricing helper accepts the subset of Season fields it needs.
      { id: seasonRow.id, priceCentsByDuration: seasonRow.priceCentsByDuration as never },
      data.duration,
    );
  } catch (err) {
    if (err instanceof PriceConfigurationError) {
      return { ok: false, error: "PRICING_MISSING" };
    }
    throw err;
  }

  const existing = await prisma.booking.findFirst({
    where: {
      bookerId: session.user.id,
      instructorId: data.instructorId,
      date: dayUtc,
      anchorTime: data.time,
      status: BookingStatus.PENDING_PAYMENT,
      createdAt: { gt: new Date(now.getTime() - IDEMPOTENCY_WINDOW_MS) },
      stripePaymentIntentId: { not: null },
    },
    select: { id: true, stripePaymentIntentId: true, totalPriceCents: true },
  });

  if (existing?.stripePaymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(
      existing.stripePaymentIntentId,
    );
    if (pi.client_secret) {
      return {
        ok: true,
        bookingId: existing.id,
        clientSecret: pi.client_secret,
        totalPriceCents: existing.totalPriceCents,
        reused: true,
      };
    }
  }

  const attendeeRows = buildAttendeeRows(data.attendees, data.bookerName, now);
  const icsUid = newIcsUid();

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookerId: session.user.id,
        instructorId: data.instructorId,
        date: dayUtc,
        anchorTime: data.time,
        duration: data.duration,
        language: data.language,
        status: BookingStatus.PENDING_PAYMENT,
        totalPriceCents,
        icsUid,
        notes: data.notes ? data.notes : null,
      },
      select: { id: true },
    });
    await tx.attendee.createMany({
      data: attendeeRows.map((row) => ({
        bookingId: created.id,
        name: row.name,
        birthDate: row.birthDate,
        level: row.level,
        isBooker: row.isBooker,
      })),
    });
    return created;
  });

  const intent = await stripe.paymentIntents.create(
    {
      amount: totalPriceCents,
      currency: "chf",
      automatic_payment_methods: { enabled: true, allow_redirects: "always" },
      metadata: {
        bookingId: booking.id,
        bookerId: session.user.id,
        instructorId: data.instructorId,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
      },
      description: `Snowboard lesson · ${data.duration} · ${data.date} ${data.time}`,
    },
    { idempotencyKey: `booking-${booking.id}` },
  );

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripePaymentIntentId: intent.id },
  });

  if (!intent.client_secret) {
    throw new Error("Stripe returned a PaymentIntent without a client_secret");
  }

  return {
    ok: true,
    bookingId: booking.id,
    clientSecret: intent.client_secret,
    totalPriceCents,
    reused: false,
  };
}
