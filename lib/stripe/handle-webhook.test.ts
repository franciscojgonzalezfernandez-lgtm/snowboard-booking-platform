import { describe, expect, test, vi } from "vitest";
import type Stripe from "stripe";
import { BookingStatus, CreditStatus } from "@prisma/client";

import {
  handleStripeWebhook,
  type StripeWebhookVerifier,
  type WebhookEventStore,
} from "./handle-webhook";

type EventShape = {
  id: string;
  type: Stripe.Event["type"];
  data?: { object: unknown };
};

function makeStripe(opts: {
  /** If set, constructEvent returns this event. Otherwise it throws. */
  event?: EventShape;
}): StripeWebhookVerifier {
  const constructEvent: Stripe["webhooks"]["constructEvent"] = (() => {
    if (opts.event) return opts.event as unknown as Stripe.Event;
    throw new Error("invalid_signature");
  }) as Stripe["webhooks"]["constructEvent"];
  return { webhooks: { constructEvent: vi.fn(constructEvent) } };
}

type BookingRow = {
  id: string;
  stripePaymentIntentId: string;
  status: BookingStatus;
  failureReason?: string | null;
  paidAt?: Date | null;
  refundedAt?: Date | null;
  refundAmountCents?: number | null;
};

type CreditRow = {
  id: string;
  lockedByBookingId: string | null;
  usedOnBookingId: string | null;
  status: CreditStatus;
};

function makePrisma(opts: {
  /** Webhook event ids already processed. */
  existingEvents?: Set<string>;
  /** Seed bookings keyed by stripePaymentIntentId. */
  bookings?: BookingRow[];
  /** F-060: credits locked/used by a draft, for settle/release assertions. */
  credits?: CreditRow[];
}) {
  const existingEvents = opts.existingEvents ?? new Set<string>();
  const bookings = new Map<string, BookingRow>(
    (opts.bookings ?? []).map((b) => [b.stripePaymentIntentId, b]),
  );
  const credits = (opts.credits ?? []).map((c) => ({ ...c }));
  const eventUpdates: Array<{ id: string; processedAt: Date | null }> = [];
  const bookingUpdates: Array<{ id: string; data: Record<string, unknown> }> =
    [];
  const creditUpdates: Array<{
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }> = [];

  const eventCreateMany = vi.fn(
    async (args: { data: Array<{ id: string }> }) => {
      let inserted = 0;
      for (const row of args.data) {
        if (!existingEvents.has(row.id)) {
          existingEvents.add(row.id);
          inserted++;
        }
      }
      return { count: inserted };
    },
  );
  const eventUpdate = vi.fn(
    async (args: { where: { id: string }; data: { processedAt: Date } }) => {
      eventUpdates.push({
        id: args.where.id,
        processedAt: args.data.processedAt,
      });
      return { id: args.where.id };
    },
  );
  const bookingFindUnique = vi.fn(
    async (args: {
      where: { stripePaymentIntentId: string };
      select?: unknown;
    }) => {
      const row = bookings.get(args.where.stripePaymentIntentId);
      if (!row) return null;
      return { id: row.id, status: row.status };
    },
  );
  const bookingUpdate = vi.fn(
    async (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      bookingUpdates.push({ id: args.where.id, data: args.data });
      for (const row of bookings.values()) {
        if (row.id === args.where.id) {
          Object.assign(row, args.data);
        }
      }
      return { id: args.where.id };
    },
  );

  const creditUpdateMany = vi.fn(
    async (args: {
      where: { lockedByBookingId: string; status: CreditStatus };
      data: Record<string, unknown>;
    }) => {
      creditUpdates.push({ where: args.where, data: args.data });
      let count = 0;
      for (const credit of credits) {
        if (
          credit.lockedByBookingId === args.where.lockedByBookingId &&
          credit.status === args.where.status
        ) {
          Object.assign(credit, args.data);
          count++;
        }
      }
      return { count };
    },
  );

  const prisma = {
    webhookEvent: { createMany: eventCreateMany, update: eventUpdate },
    booking: { findUnique: bookingFindUnique, update: bookingUpdate },
    accountCredit: { updateMany: creditUpdateMany },
  } as unknown as WebhookEventStore;

  return {
    prisma,
    eventUpdates,
    bookingUpdates,
    creditUpdates,
    credits,
    spies: {
      eventCreateMany,
      eventUpdate,
      bookingFindUnique,
      bookingUpdate,
      creditUpdateMany,
    },
  };
}

function paymentIntentEvent(
  id: string,
  type:
    | "payment_intent.succeeded"
    | "payment_intent.payment_failed"
    | "payment_intent.canceled",
  pi: Partial<Stripe.PaymentIntent> & { id: string },
): EventShape {
  return { id, type, data: { object: pi } };
}

function chargeRefundedEvent(
  id: string,
  charge: Partial<Stripe.Charge> & { payment_intent: string },
): EventShape {
  return { id, type: "charge.refunded", data: { object: charge } };
}

function disputeCreatedEvent(
  id: string,
  dispute: Partial<Stripe.Dispute> & { id: string; payment_intent: string },
): EventShape {
  return { id, type: "charge.dispute.created", data: { object: dispute } };
}

describe("handleStripeWebhook — pre-routing", () => {
  test("returns 500 + captures error when STRIPE_WEBHOOK_SECRET is missing", async () => {
    const onError = vi.fn();
    const { prisma, spies } = makePrisma({});
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_1", "payment_intent.succeeded", {
        id: "pi_1",
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=abc",
      secret: undefined,
      stripe,
      prisma,
      onError,
    });

    expect(out.status).toBe(500);
    expect(spies.eventCreateMany).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  test("returns 400 when stripe-signature header is missing", async () => {
    const { prisma, spies } = makePrisma({});
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_1", "payment_intent.succeeded", {
        id: "pi_1",
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: null,
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(400);
    expect(spies.eventCreateMany).not.toHaveBeenCalled();
  });

  test("returns 400 + captures error when signature verification fails", async () => {
    const onError = vi.fn();
    const { prisma, spies } = makePrisma({});
    const stripe = makeStripe({}); // no event → throws

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=bogus",
      secret: "whsec_test",
      stripe,
      prisma,
      onError,
    });

    expect(out.status).toBe(400);
    expect(spies.eventCreateMany).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  test("returns 200 + duplicate flag and skips routing when event was already processed", async () => {
    const { prisma, spies, eventUpdates, bookingUpdates } = makePrisma({
      existingEvents: new Set(["evt_dup"]),
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_dup", "payment_intent.succeeded", {
        id: "pi_dup",
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({ ok: true, duplicate: true });
    expect(spies.eventCreateMany).toHaveBeenCalledOnce();
    expect(spies.bookingFindUnique).not.toHaveBeenCalled();
    expect(eventUpdates).toHaveLength(0);
    expect(bookingUpdates).toHaveLength(0);
  });
});

describe("handleStripeWebhook — payment_intent.succeeded", () => {
  test("flips PENDING_PAYMENT → CONFIRMED, sets paidAt, dispatches confirmation email", async () => {
    const { prisma, bookingUpdates, eventUpdates } = makePrisma({
      bookings: [
        {
          id: "book_1",
          stripePaymentIntentId: "pi_succ",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_succ", "payment_intent.succeeded", {
        id: "pi_succ",
      }),
    });
    const dispatch = vi.fn(async () => undefined);

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
      dispatchBookingConfirmedEmail: dispatch,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates).toHaveLength(1);
    expect(bookingUpdates[0]!.id).toBe("book_1");
    expect(bookingUpdates[0]!.data.status).toBe(BookingStatus.CONFIRMED);
    expect(bookingUpdates[0]!.data.paidAt).toBeInstanceOf(Date);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith("book_1");
    expect(eventUpdates).toHaveLength(1);
  });

  test("does not flip status when booking is already CONFIRMED (defensive guard)", async () => {
    const { prisma, bookingUpdates } = makePrisma({
      bookings: [
        {
          id: "book_already",
          stripePaymentIntentId: "pi_already",
          status: BookingStatus.CONFIRMED,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_already", "payment_intent.succeeded", {
        id: "pi_already",
      }),
    });
    const dispatch = vi.fn(async () => undefined);

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
      dispatchBookingConfirmedEmail: dispatch,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates).toHaveLength(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("logs + 200 OK when no booking matches the PaymentIntent id (no Stripe retry)", async () => {
    const onError = vi.fn();
    const { prisma, bookingUpdates, eventUpdates } = makePrisma({});
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_orphan", "payment_intent.succeeded", {
        id: "pi_orphan",
      }),
    });
    const dispatch = vi.fn(async () => undefined);

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
      onError,
      dispatchBookingConfirmedEmail: dispatch,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates).toHaveLength(0);
    expect(dispatch).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    expect(eventUpdates).toHaveLength(1);
  });

  test("does not rethrow when the email dispatch fails — booking stays CONFIRMED", async () => {
    const onError = vi.fn();
    const { prisma, bookingUpdates, eventUpdates } = makePrisma({
      bookings: [
        {
          id: "book_email_fail",
          stripePaymentIntentId: "pi_email_fail",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_email_fail", "payment_intent.succeeded", {
        id: "pi_email_fail",
      }),
    });
    const dispatch = vi.fn(async () => {
      throw new Error("resend_timeout");
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
      onError,
      dispatchBookingConfirmedEmail: dispatch,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates).toHaveLength(1);
    expect(bookingUpdates[0]!.data.status).toBe(BookingStatus.CONFIRMED);
    expect(eventUpdates).toHaveLength(1);
    expect(onError).toHaveBeenCalled();
    const ctx = onError.mock.calls[0]?.[1];
    expect((ctx as Record<string, unknown>).stage).toBe(
      "dispatch_booking_confirmed_email",
    );
  });
});

describe("handleStripeWebhook — payment_intent.payment_failed", () => {
  test("flips to PAYMENT_FAILED and records last_payment_error.message", async () => {
    const { prisma, bookingUpdates } = makePrisma({
      bookings: [
        {
          id: "book_fail",
          stripePaymentIntentId: "pi_fail",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_fail", "payment_intent.payment_failed", {
        id: "pi_fail",
        last_payment_error: {
          message: "Your card was declined.",
        } as unknown as Stripe.PaymentIntent.LastPaymentError,
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates).toHaveLength(1);
    expect(bookingUpdates[0]!.data.status).toBe(BookingStatus.PAYMENT_FAILED);
    expect(bookingUpdates[0]!.data.failureReason).toBe(
      "Your card was declined.",
    );
  });

  test("falls back to last_payment_error.code when message is absent", async () => {
    const { prisma, bookingUpdates } = makePrisma({
      bookings: [
        {
          id: "book_codeonly",
          stripePaymentIntentId: "pi_codeonly",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_codeonly", "payment_intent.payment_failed", {
        id: "pi_codeonly",
        last_payment_error: {
          code: "card_declined",
        } as unknown as Stripe.PaymentIntent.LastPaymentError,
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates[0]!.data.failureReason).toBe("card_declined");
  });
});

describe("handleStripeWebhook — payment_intent.canceled", () => {
  test("flips to CANCELLED_BY_SYSTEM", async () => {
    const { prisma, bookingUpdates } = makePrisma({
      bookings: [
        {
          id: "book_can",
          stripePaymentIntentId: "pi_can",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_can", "payment_intent.canceled", {
        id: "pi_can",
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates[0]!.data.status).toBe(
      BookingStatus.CANCELLED_BY_SYSTEM,
    );
  });
});

describe("handleStripeWebhook — charge.refunded", () => {
  test("flips to REFUNDED, records refundedAt + amount_refunded", async () => {
    const { prisma, bookingUpdates } = makePrisma({
      bookings: [
        {
          id: "book_ref",
          stripePaymentIntentId: "pi_ref",
          status: BookingStatus.CONFIRMED,
        },
      ],
    });
    const stripe = makeStripe({
      event: chargeRefundedEvent("evt_ref", {
        payment_intent: "pi_ref",
        amount_refunded: 11000,
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates[0]!.data.status).toBe(BookingStatus.REFUNDED);
    expect(bookingUpdates[0]!.data.refundedAt).toBeInstanceOf(Date);
    expect(bookingUpdates[0]!.data.refundAmountCents).toBe(11000);
  });
});

describe("handleStripeWebhook — charge.dispute.created", () => {
  test("does not mutate the booking; raises an alert via onError with dispute context", async () => {
    const onError = vi.fn();
    const { prisma, bookingUpdates } = makePrisma({
      bookings: [
        {
          id: "book_dis",
          stripePaymentIntentId: "pi_dis",
          status: BookingStatus.CONFIRMED,
        },
      ],
    });
    const stripe = makeStripe({
      event: disputeCreatedEvent("evt_dis", {
        id: "dp_1",
        payment_intent: "pi_dis",
        amount: 11000,
        reason: "fraudulent",
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
      onError,
    });

    expect(out.status).toBe(200);
    expect(bookingUpdates).toHaveLength(0);
    expect(onError).toHaveBeenCalled();
    const ctx = onError.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(ctx.stage).toBe("charge.dispute.created");
    expect(ctx.severity).toBe("alert");
    expect(ctx.disputeId).toBe("dp_1");
    expect(ctx.paymentIntentId).toBe("pi_dis");
  });
});

describe("handleStripeWebhook — F-060 credit settlement", () => {
  test("succeeded settles credits LOCKED → USED keyed on lockedByBookingId", async () => {
    const { prisma, credits, spies } = makePrisma({
      bookings: [
        {
          id: "book_credit",
          stripePaymentIntentId: "pi_credit",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
      credits: [
        {
          id: "cr_1",
          lockedByBookingId: "book_credit",
          usedOnBookingId: null,
          status: CreditStatus.LOCKED,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_credit", "payment_intent.succeeded", {
        id: "pi_credit",
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
      dispatchBookingConfirmedEmail: vi.fn(async () => undefined),
    });

    expect(out.status).toBe(200);
    expect(spies.creditUpdateMany).toHaveBeenCalledOnce();
    expect(credits[0]!.status).toBe(CreditStatus.USED);
    expect(credits[0]!.usedOnBookingId).toBe("book_credit");
  });

  test("succeeded credit settlement is idempotent — second pass affects 0 rows", async () => {
    const { prisma, credits } = makePrisma({
      bookings: [
        {
          id: "book_dup_credit",
          stripePaymentIntentId: "pi_dup_credit",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
      credits: [
        {
          id: "cr_dup",
          lockedByBookingId: "book_dup_credit",
          usedOnBookingId: "book_dup_credit",
          status: CreditStatus.USED,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_dup_credit", "payment_intent.succeeded", {
        id: "pi_dup_credit",
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
      dispatchBookingConfirmedEmail: vi.fn(async () => undefined),
    });

    expect(out.status).toBe(200);
    // Already USED → status guard matches 0 rows, value unchanged.
    expect(credits[0]!.status).toBe(CreditStatus.USED);
  });

  test("payment_failed releases credits LOCKED → ACTIVE", async () => {
    const { prisma, credits } = makePrisma({
      bookings: [
        {
          id: "book_failcredit",
          stripePaymentIntentId: "pi_failcredit",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
      credits: [
        {
          id: "cr_fail",
          lockedByBookingId: "book_failcredit",
          usedOnBookingId: null,
          status: CreditStatus.LOCKED,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_failcredit", "payment_intent.payment_failed", {
        id: "pi_failcredit",
        last_payment_error: {
          message: "declined",
        } as unknown as Stripe.PaymentIntent.LastPaymentError,
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(200);
    expect(credits[0]!.status).toBe(CreditStatus.ACTIVE);
    expect(credits[0]!.lockedByBookingId).toBeNull();
  });

  test("canceled releases credits LOCKED → ACTIVE", async () => {
    const { prisma, credits } = makePrisma({
      bookings: [
        {
          id: "book_cancredit",
          stripePaymentIntentId: "pi_cancredit",
          status: BookingStatus.PENDING_PAYMENT,
        },
      ],
      credits: [
        {
          id: "cr_can",
          lockedByBookingId: "book_cancredit",
          usedOnBookingId: null,
          status: CreditStatus.LOCKED,
        },
      ],
    });
    const stripe = makeStripe({
      event: paymentIntentEvent("evt_cancredit", "payment_intent.canceled", {
        id: "pi_cancredit",
      }),
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(200);
    expect(credits[0]!.status).toBe(CreditStatus.ACTIVE);
    expect(credits[0]!.lockedByBookingId).toBeNull();
  });
});
