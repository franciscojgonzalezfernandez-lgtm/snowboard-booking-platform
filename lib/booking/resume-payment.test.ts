import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingStatus } from "@prisma/client";
import type Stripe from "stripe";

import {
  RESUME_WINDOW_MS,
  type ResumePaymentDeps,
  resumePaymentWith,
} from "./resume-payment";
import { makeBookingFixture, type BookingFixture } from "./fixtures";

const NOW = new Date("2026-12-15T17:00:00.000Z");

// Suite defaults on top of the shared fixture: a 5-minute-old PENDING_PAYMENT
// draft with a live PaymentIntent. Legacy default: no credit columns written →
// resume falls back to totalPriceCents; credit scenarios override explicitly.
function baseBooking(overrides: Partial<BookingFixture> = {}): BookingFixture {
  return makeBookingFixture({
    id: "bk_1",
    bookerId: "user_1",
    status: BookingStatus.PENDING_PAYMENT,
    stripePaymentIntentId: "pi_existing",
    createdAt: new Date(NOW.getTime() - 5 * 60_000),
    date: new Date("2027-01-15T00:00:00.000Z"),
    anchorTime: "10:00",
    ...overrides,
  });
}

function makeDeps(opts: {
  booking: BookingFixture | null;
  retrieve?: Pick<Stripe.PaymentIntent, "id" | "client_secret" | "status">;
  retrieveImpl?: (id: string) => Promise<
    Pick<Stripe.PaymentIntent, "id" | "client_secret" | "status">
  >;
  create?: Pick<Stripe.PaymentIntent, "id" | "client_secret" | "status">;
  bookerId?: string;
  now?: Date;
}): {
  deps: ResumePaymentDeps;
  updates: Array<{
    where: { id: string };
    data: Record<string, unknown>;
  }>;
  retrieveCalls: string[];
  createCalls: Array<{
    params: Stripe.PaymentIntentCreateParams;
    options?: Stripe.RequestOptions;
  }>;
} {
  let bookingRef = opts.booking ? { ...opts.booking } : null;
  const updates: Array<{
    where: { id: string };
    data: Record<string, unknown>;
  }> = [];
  const retrieveCalls: string[] = [];
  const createCalls: Array<{
    params: Stripe.PaymentIntentCreateParams;
    options?: Stripe.RequestOptions;
  }> = [];

  const deps: ResumePaymentDeps = {
    prisma: {
      booking: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (!bookingRef || bookingRef.id !== where.id) return null;
          return { ...bookingRef };
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          updates.push({ where, data: { ...data } });
          if (bookingRef && bookingRef.id === where.id) {
            bookingRef = { ...bookingRef, ...(data as Partial<BookingFixture>) };
          }
          return { id: where.id };
        },
      },
    } as unknown as ResumePaymentDeps["prisma"],
    stripe: {
      paymentIntents: {
        retrieve: vi.fn(async (id: string) => {
          retrieveCalls.push(id);
          if (opts.retrieveImpl) return opts.retrieveImpl(id);
          return (
            opts.retrieve ?? {
              id,
              client_secret: "pi_existing_secret",
              status: "requires_payment_method",
            }
          );
        }) as ResumePaymentDeps["stripe"]["paymentIntents"]["retrieve"],
        create: vi.fn(async (params, options) => {
          createCalls.push({ params, options });
          return (
            opts.create ?? {
              id: "pi_new",
              client_secret: "pi_new_secret",
              status: "requires_payment_method",
            }
          );
        }) as ResumePaymentDeps["stripe"]["paymentIntents"]["create"],
      },
    },
    bookerId: opts.bookerId ?? "user_1",
    now: opts.now ?? NOW,
  };

  return { deps, updates, retrieveCalls, createCalls };
}

describe("resumePaymentWith", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("returns NOT_FOUND when the booking does not exist", async () => {
    const { deps } = makeDeps({ booking: null });
    const result = await resumePaymentWith(deps, "bk_missing");
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  test("returns FORBIDDEN when the caller is not the booker", async () => {
    const { deps } = makeDeps({
      booking: baseBooking(),
      bookerId: "stranger",
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  test("returns ALREADY_CONFIRMED when the booking is already CONFIRMED", async () => {
    const { deps } = makeDeps({
      booking: baseBooking({ status: BookingStatus.CONFIRMED }),
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({ ok: false, error: "ALREADY_CONFIRMED" });
  });

  test("returns NOT_RESUMABLE for non-PENDING_PAYMENT/COMPLETED/CONFIRMED states", async () => {
    const { deps } = makeDeps({
      booking: baseBooking({ status: BookingStatus.CANCELLED_BY_USER }),
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({ ok: false, error: "NOT_RESUMABLE" });
  });

  test("returns EXPIRED + flips booking to PAYMENT_FAILED when older than the window", async () => {
    const { deps, updates } = makeDeps({
      booking: baseBooking({
        createdAt: new Date(NOW.getTime() - RESUME_WINDOW_MS - 1),
      }),
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({ ok: false, error: "EXPIRED" });
    expect(updates).toEqual([
      { where: { id: "bk_1" }, data: { status: "PAYMENT_FAILED" } },
    ]);
  });

  test("boundary: createdAt exactly at the 15m mark is treated as EXPIRED (>=)", async () => {
    const { deps } = makeDeps({
      booking: baseBooking({
        createdAt: new Date(NOW.getTime() - RESUME_WINDOW_MS),
      }),
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("EXPIRED");
  });

  test("reuses an existing PaymentIntent when Stripe reports it is still payable", async () => {
    const { deps, createCalls, retrieveCalls } = makeDeps({
      booking: baseBooking(),
      retrieve: {
        id: "pi_existing",
        client_secret: "secret_live",
        status: "requires_payment_method",
      },
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({
      ok: true,
      bookingId: "bk_1",
      clientSecret: "secret_live",
      totalPriceCents: 11000,
      chargeAmountCents: 11000,
      creditsAppliedCents: 0,
    });
    expect(retrieveCalls).toEqual(["pi_existing"]);
    expect(createCalls).toEqual([]);
  });

  test("recreates the PaymentIntent silently when Stripe says the existing one is canceled", async () => {
    const { deps, createCalls, updates } = makeDeps({
      booking: baseBooking(),
      retrieve: {
        id: "pi_existing",
        client_secret: null,
        status: "canceled",
      },
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({
      ok: true,
      bookingId: "bk_1",
      clientSecret: "pi_new_secret",
      totalPriceCents: 11000,
      chargeAmountCents: 11000,
      creditsAppliedCents: 0,
    });
    expect(createCalls.length).toBe(1);
    expect(createCalls[0]!.params.amount).toBe(11000);
    expect(createCalls[0]!.params.currency).toBe("chf");
    expect(createCalls[0]!.options?.idempotencyKey).toMatch(/^booking-bk_1-resume-\d+$/);
    // Booking now points at the fresh PaymentIntent.
    expect(updates).toEqual([
      { where: { id: "bk_1" }, data: { stripePaymentIntentId: "pi_new" } },
    ]);
  });

  // F-084 regression: a booking that applied credits at checkout must resume at
  // the NET charge (price minus credits), never the full lesson price. Before
  // the fix, resume read totalPriceCents and re-billed the full amount while the
  // credits stayed LOCKED — charging twice over.
  test("reuse path: a credit-applied booking returns the net charge, not the full price", async () => {
    const { deps } = makeDeps({
      booking: baseBooking({
        totalPriceCents: 20000,
        chargeAmountCents: 9000,
        creditsAppliedCents: 11000,
      }),
      retrieve: {
        id: "pi_existing",
        client_secret: "secret_live",
        status: "requires_payment_method",
      },
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({
      ok: true,
      bookingId: "bk_1",
      clientSecret: "secret_live",
      totalPriceCents: 20000,
      chargeAmountCents: 9000,
      creditsAppliedCents: 11000,
    });
  });

  test("recreate path: a credit-applied booking re-bills the net charge + carries credit metadata", async () => {
    const { deps, createCalls } = makeDeps({
      booking: baseBooking({
        totalPriceCents: 20000,
        chargeAmountCents: 9000,
        creditsAppliedCents: 11000,
      }),
      retrieve: { id: "pi_existing", client_secret: null, status: "canceled" },
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.chargeAmountCents).toBe(9000);
    expect(createCalls.length).toBe(1);
    // The fresh PaymentIntent bills 9000 (net), NOT 20000 (full price).
    expect(createCalls[0]!.params.amount).toBe(9000);
    expect(createCalls[0]!.params.metadata?.creditsAppliedCents).toBe("11000");
  });

  test("returns ALREADY_CONFIRMED when Stripe says the existing PaymentIntent succeeded", async () => {
    const { deps, createCalls } = makeDeps({
      booking: baseBooking(),
      retrieve: {
        id: "pi_existing",
        client_secret: null,
        status: "succeeded",
      },
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({ ok: false, error: "ALREADY_CONFIRMED" });
    expect(createCalls).toEqual([]);
  });

  test("creates a fresh PaymentIntent when the booking has no Stripe id linked", async () => {
    const { deps, createCalls } = makeDeps({
      booking: baseBooking({ stripePaymentIntentId: null }),
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result.ok).toBe(true);
    expect(createCalls.length).toBe(1);
    expect(createCalls[0]!.params.metadata?.bookingId).toBe("bk_1");
  });

  test("returns STRIPE_BAD_STATE when Stripe creates a PaymentIntent without a client_secret", async () => {
    const { deps } = makeDeps({
      booking: baseBooking({ stripePaymentIntentId: null }),
      create: {
        id: "pi_new",
        client_secret: null,
        status: "requires_payment_method",
      },
    });
    const result = await resumePaymentWith(deps, "bk_1");
    expect(result).toEqual({ ok: false, error: "STRIPE_BAD_STATE" });
  });
});
