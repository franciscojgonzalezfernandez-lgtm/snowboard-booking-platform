import { randomUUID } from "crypto";

import { BookingStatus, CreditStatus, type Duration } from "@prisma/client";
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
  /**
   * F-060 zero-charge path: a booking fully covered by credits is created
   * CONFIRMED here (no PaymentIntent, so the Stripe webhook never fires), so
   * the confirmation email + .ics must be dispatched from this action instead.
   * Defaults to a no-op; the real wrapper injects `sendBookingConfirmedEmail`.
   * Failures are swallowed (booking is already CONFIRMED) — wrap with Sentry in
   * the caller.
   */
  dispatchBookingConfirmedEmail?: (bookingId: string) => Promise<void>;
};

/** A credit row as loaded for redemption selection. */
type CreditRow = { id: string; amountCents: number; expiresAt: Date };

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
  accountCredit: {
    findMany(args: {
      where: {
        id: { in: string[] };
        userId: string;
        status: CreditStatus;
        expiresAt: { gt: Date };
      };
      select: { id: true; amountCents: true; expiresAt: true };
    }): Promise<CreditRow[]>;
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
        paidAt?: Date;
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
  user: {
    update(args: {
      where: { id: string; phone: null };
      data: { phone: string };
    }): Promise<{ id: string }>;
  };
  accountCredit: {
    updateMany(args: {
      where: {
        id: { in: string[] };
        userId: string;
        status: CreditStatus;
        expiresAt: { gt: Date };
      };
      data:
        | { status: CreditStatus; lockedByBookingId: string }
        | { status: CreditStatus; usedAt: Date; usedOnBookingId: string };
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
    ): Promise<
      Pick<Stripe.PaymentIntent, "id" | "client_secret" | "amount" | "metadata">
    >;
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

/** Raised inside the draft transaction when a guarded credit lock/use write
 * matches fewer rows than expected — a concurrent draft grabbed one of the
 * selected credits between the read and the write. Rolls back the booking. */
class CreditConflictError extends Error {
  constructor() {
    super("CREDIT_NOT_APPLICABLE");
    this.name = "CreditConflictError";
  }
}

/**
 * Oldest-first cap (F-060). Consume credits in expiry-ascending order until the
 * lesson price is covered; the credit that crosses the threshold is consumed in
 * full (all-or-nothing per credit — no partial use). Any selected credits past
 * the coverage point are left untouched (returned as ACTIVE).
 */
function selectCreditsToApply(
  credits: CreditRow[],
  totalPriceCents: number,
): { consumedIds: string[]; creditsAppliedCents: number } {
  const sorted = [...credits].sort(
    (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime(),
  );
  const consumedIds: string[] = [];
  let creditsAppliedCents = 0;
  for (const credit of sorted) {
    if (creditsAppliedCents >= totalPriceCents) break;
    consumedIds.push(credit.id);
    creditsAppliedCents += credit.amountCents;
  }
  return { consumedIds, creditsAppliedCents };
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

  // Reuse an in-flight draft BEFORE re-resolving credits: on a resubmit the
  // chosen credits are already LOCKED by the first attempt, so a fresh ACTIVE
  // lookup would (correctly) reject them. The existing PaymentIntent already
  // encodes the charge + locked credits, so short-circuit to it here.
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
      // Reflect the charge + credits locked on the first submit, not the
      // (possibly changed) current selection. Changing credits requires
      // voiding the draft first.
      const reusedCredits = Number(pi.metadata?.creditsAppliedCents ?? 0);
      return {
        ok: true,
        bookingId: existing.id,
        clientSecret: pi.client_secret,
        totalPriceCents: existing.totalPriceCents,
        chargeAmountCents: pi.amount,
        creditsAppliedCents: Number.isFinite(reusedCredits) ? reusedCredits : 0,
        reused: true,
      };
    }
  }

  // F-060: resolve which of the chosen credits actually apply (owned, ACTIVE,
  // unexpired) and how much they cover. The guarded write inside the transaction
  // is what protects against concurrent double-spend; this read drives the
  // charge amount + the zero-charge vs normal branch.
  const selectedCreditIds = data.creditIds ?? [];
  let consumedIds: string[] = [];
  let creditsAppliedCents = 0;
  if (selectedCreditIds.length > 0) {
    const credits = await prisma.accountCredit.findMany({
      where: {
        id: { in: selectedCreditIds },
        userId: session.user.id,
        status: CreditStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      select: { id: true, amountCents: true, expiresAt: true },
    });
    // Any selected credit that is not owned / not ACTIVE / expired drops out of
    // the result set — reject the whole request rather than silently applying a
    // subset the booker did not expect.
    if (credits.length !== selectedCreditIds.length) {
      return { ok: false, error: "CREDIT_NOT_APPLICABLE" };
    }
    ({ consumedIds, creditsAppliedCents } = selectCreditsToApply(
      credits,
      totalPriceCents,
    ));
  }

  const chargeAmountCents = Math.max(0, totalPriceCents - creditsAppliedCents);
  const isZeroCharge = chargeAmountCents === 0 && consumedIds.length > 0;
  const overshootCents = Math.max(0, creditsAppliedCents - totalPriceCents);

  const attendeeRows = buildAttendeeRows(data.attendees, data.bookerName, now);
  const icsUid = newIcsUid();
  const noteParts: string[] = [];
  if (data.notes) noteParts.push(data.notes);
  if (overshootCents > 0) {
    noteParts.push(
      `[F-060 credit overshoot: applied ${creditsAppliedCents} cents vs price ${totalPriceCents} cents]`,
    );
  }
  const notes = noteParts.length > 0 ? noteParts.join("\n") : null;

  let booking: { id: string };
  try {
    booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookerId: session.user.id,
          instructorId: data.instructorId,
          date: dayUtc,
          anchorTime: data.time,
          duration: data.duration,
          language: data.language,
          status: isZeroCharge
            ? BookingStatus.CONFIRMED
            : BookingStatus.PENDING_PAYMENT,
          totalPriceCents,
          icsUid,
          notes,
          ...(isZeroCharge ? { paidAt: now } : {}),
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

      // F-064(a): silently backfill the booker's phone the first time they book.
      // `data.bookerPhone` is already E.164-normalised by the draft schema. The
      // `phone: null` guard makes this a no-op once a number is on file, so a
      // second booking never overwrites a value the user set in the dashboard —
      // and the atomic predicate avoids a read/write race between concurrent
      // requests. Best-effort: a no-match (P2025) or transient failure must never
      // roll back the booking, so we swallow it inside the transaction callback.
      try {
        await tx.user.update({
          where: { id: session.user.id, phone: null },
          data: { phone: data.bookerPhone },
        });
      } catch {
        // phone already set, or transient write error — leave the profile as-is.
      }

      // F-060 credit consumption. The `status: ACTIVE` + `expiresAt > now` guard
      // is the double-spend lock: if a concurrent draft already moved one of
      // these credits out of ACTIVE, the count mismatches and we roll back.
      // Zero-charge bookings consume credits outright (ACTIVE → USED) since
      // there is no payment to wait on; normal bookings lock them (ACTIVE →
      // LOCKED) until the webhook confirms or fails the payment.
      if (consumedIds.length > 0) {
        const result = await tx.accountCredit.updateMany({
          where: {
            id: { in: consumedIds },
            userId: session.user.id,
            status: CreditStatus.ACTIVE,
            expiresAt: { gt: now },
          },
          data: isZeroCharge
            ? {
                status: CreditStatus.USED,
                usedAt: now,
                usedOnBookingId: created.id,
              }
            : {
                status: CreditStatus.LOCKED,
                lockedByBookingId: created.id,
              },
        });
        if (result.count !== consumedIds.length) {
          throw new CreditConflictError();
        }
      }

      return created;
    });
  } catch (err) {
    if (err instanceof CreditConflictError) {
      return { ok: false, error: "CREDIT_NOT_APPLICABLE" };
    }
    throw err;
  }

  // Zero-charge: the booking is already CONFIRMED and no PaymentIntent exists,
  // so the Stripe webhook will never fire. Dispatch the confirmation email +
  // .ics here instead. Email failure must not fail the booking.
  if (isZeroCharge) {
    if (deps.dispatchBookingConfirmedEmail) {
      try {
        await deps.dispatchBookingConfirmedEmail(booking.id);
      } catch {
        // booking is CONFIRMED; the email is reissuable from the admin panel.
      }
    }
    return {
      ok: true,
      bookingId: booking.id,
      clientSecret: null,
      totalPriceCents,
      chargeAmountCents: 0,
      creditsAppliedCents,
      reused: false,
    };
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount: chargeAmountCents,
      currency: "chf",
      automatic_payment_methods: { enabled: true, allow_redirects: "always" },
      metadata: {
        bookingId: booking.id,
        bookerId: session.user.id,
        instructorId: data.instructorId,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        creditsAppliedCents: String(creditsAppliedCents),
        lockedCreditIds: consumedIds.join(","),
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
    chargeAmountCents,
    creditsAppliedCents,
    reused: false,
  };
}
