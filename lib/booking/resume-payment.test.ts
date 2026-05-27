import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingStatus, Duration } from "@prisma/client";
import type Stripe from "stripe";

import {
  RESUME_WINDOW_MS,
  type ResumePaymentDeps,
  resumePaymentWith,
} from "./resume-payment";

type BookingFixture = {
  id: string;
  bookerId: string;
  instructorId: string;
  status: BookingStatus;
  totalPriceCents: number;
  stripePaymentIntentId: string | null;
  createdAt: Date;
  date: Date;
  anchorTime: string;
  duration: Duration;
};

const NOW = new Date("2026-12-15T17:00:00.000Z");

function baseBooking(overrides: Partial<BookingFixture> = {}): BookingFixture {
  return {
    id: "bk_1",
    bookerId: "user_1",
    instructorId: "inst_1",
    status: BookingStatus.PENDING_PAYMENT,
    totalPriceCents: 11000,
    stripePaymentIntentId: "pi_existing",
    createdAt: new Date(NOW.getTime() - 5 * 60_000),
    date: new Date("2027-01-15T00:00:00.000Z"),
    anchorTime: "10:00",
    duration: Duration.ONE_HOUR,
    ...overrides,
  };
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
        findUnique: (async ({ where }) => {
          if (!bookingRef || bookingRef.id !== where.id) return null;
          return { ...bookingRef };
        }) as ResumePaymentDeps["prisma"]["booking"]["findUnique"],
        update: (async ({ where, data }) => {
          updates.push({ where, data: { ...data } });
          if (bookingRef && bookingRef.id === where.id) {
            bookingRef = { ...bookingRef, ...(data as Partial<BookingFixture>) };
          }
          return { id: where.id };
        }) as ResumePaymentDeps["prisma"]["booking"]["update"],
      },
    },
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
