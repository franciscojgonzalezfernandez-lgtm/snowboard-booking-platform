import type Stripe from "stripe";
import { BookingStatus, type PrismaClient } from "@prisma/client";

export type WebhookOutcome =
  | { status: 200; body: { ok: true; duplicate?: true } }
  | { status: 400; body: { error: string } }
  | { status: 500; body: { error: string } };

/**
 * Narrowed slices of the SDK + Prisma client so this module stays
 * unit-testable without conjuring a full `Stripe` or `PrismaClient` mock.
 */
export type StripeWebhookVerifier = {
  webhooks: {
    constructEvent: Stripe["webhooks"]["constructEvent"];
  };
};

export type WebhookEventStore = {
  webhookEvent: Pick<PrismaClient["webhookEvent"], "createMany" | "update">;
  booking: Pick<PrismaClient["booking"], "findUnique" | "update">;
};

export type DispatchBookingConfirmedEmail = (
  bookingId: string,
) => Promise<void>;

export type HandleWebhookOptions = {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
  stripe: StripeWebhookVerifier;
  prisma: WebhookEventStore;
  /** Optional Sentry-shaped sink for observability; tests pass a stub. */
  onError?: (err: unknown, ctx: Record<string, unknown>) => void;
  /**
   * Email dispatcher invoked after a booking moves to CONFIRMED. Defaults to
   * a no-op so F-044 can land before F-045 wires the real Resend pipeline.
   * Failures here are logged via `onError` and do NOT roll back the booking
   * status (the row is already CONFIRMED; admin can resend manually).
   */
  dispatchBookingConfirmedEmail?: DispatchBookingConfirmedEmail;
};

/**
 * Pure-ish handler for an inbound Stripe webhook. Extracted from the route
 * file so it's unit-testable with mock Stripe + Prisma.
 *
 * Contract:
 *   1. Reject if secret is missing (500 — wiring bug, not Stripe's fault).
 *   2. Reject if signature header is missing (400).
 *   3. Verify signature via Stripe SDK; reject if invalid (400).
 *   4. Insert event row with skipDuplicates — if 0 inserted, Stripe is retrying
 *      a previously-processed event. Return 200 with duplicate flag.
 *   5. Route the event to a per-type handler (F-044). Mark `processedAt`
 *      after the handler completes — a thrown handler keeps the row pending
 *      so Stripe retries hit the duplicate gate again next time.
 */
export async function handleStripeWebhook(
  opts: HandleWebhookOptions,
): Promise<WebhookOutcome> {
  if (!opts.secret) {
    opts.onError?.(new Error("missing_webhook_secret"), {
      stage: "config_check",
    });
    return {
      status: 500,
      body: { error: "Webhook not configured" },
    };
  }

  if (!opts.signature) {
    return {
      status: 400,
      body: { error: "Missing stripe-signature header" },
    };
  }

  let event: Stripe.Event;
  try {
    event = opts.stripe.webhooks.constructEvent(
      opts.rawBody,
      opts.signature,
      opts.secret,
    );
  } catch (err) {
    opts.onError?.(err, { stage: "signature_verification" });
    return {
      status: 400,
      body: { error: "Invalid signature" },
    };
  }

  const inserted = await opts.prisma.webhookEvent.createMany({
    data: [{ id: event.id, source: "stripe", type: event.type }],
    skipDuplicates: true,
  });

  if (inserted.count === 0) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  const dispatch =
    opts.dispatchBookingConfirmedEmail ??
    (async () => {
      /* no-op until F-045 */
    });

  await routeEvent(event, opts, dispatch);

  await opts.prisma.webhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() },
  });

  return { status: 200, body: { ok: true } };
}

async function routeEvent(
  event: Stripe.Event,
  opts: HandleWebhookOptions,
  dispatch: DispatchBookingConfirmedEmail,
): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await onPaymentIntentSucceeded(
        event.data.object as Stripe.PaymentIntent,
        opts,
        dispatch,
      );
      return;
    case "payment_intent.payment_failed":
      await onPaymentIntentFailed(
        event.data.object as Stripe.PaymentIntent,
        opts,
      );
      return;
    case "payment_intent.canceled":
      await onPaymentIntentCanceled(
        event.data.object as Stripe.PaymentIntent,
        opts,
      );
      return;
    case "charge.refunded":
      await onChargeRefunded(event.data.object as Stripe.Charge, opts);
      return;
    case "charge.dispute.created":
      onDisputeCreated(event.data.object as Stripe.Dispute, opts);
      return;
    default:
      // Unhandled event types: ack + move on. Anything unexpected surfaces
      // via Sentry aggregated dashboards if we configured them per-type.
      return;
  }
}

async function lookupBookingByPaymentIntent(
  paymentIntentId: string | null | undefined,
  opts: HandleWebhookOptions,
  stage: string,
): Promise<{ id: string; status: BookingStatus } | null> {
  if (!paymentIntentId) {
    opts.onError?.(new Error("missing_payment_intent_id"), { stage });
    return null;
  }
  const row = await opts.prisma.booking.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, status: true },
  });
  if (!row) {
    opts.onError?.(new Error("booking_not_found"), {
      stage,
      paymentIntentId,
    });
    return null;
  }
  return row;
}

async function onPaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
  opts: HandleWebhookOptions,
  dispatch: DispatchBookingConfirmedEmail,
): Promise<void> {
  const booking = await lookupBookingByPaymentIntent(
    pi.id,
    opts,
    "payment_intent.succeeded",
  );
  if (!booking) return;

  // Only PENDING_PAYMENT transitions to CONFIRMED. If the row is already
  // CONFIRMED (Stripe retried after we processed an earlier delivery), the
  // dedupe table should have caught it; this guard covers the edge where the
  // event id is new but the booking already flipped via another path.
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    return;
  }

  await opts.prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CONFIRMED,
      paidAt: new Date(),
    },
  });

  try {
    await dispatch(booking.id);
  } catch (err) {
    opts.onError?.(err, {
      stage: "dispatch_booking_confirmed_email",
      bookingId: booking.id,
    });
    // Do NOT rethrow: the row is CONFIRMED, the email is reissuable from the
    // admin panel (Sprint 4). Failing the webhook would make Stripe retry and
    // double-dispatch on the next delivery.
  }
}

async function onPaymentIntentFailed(
  pi: Stripe.PaymentIntent,
  opts: HandleWebhookOptions,
): Promise<void> {
  const booking = await lookupBookingByPaymentIntent(
    pi.id,
    opts,
    "payment_intent.payment_failed",
  );
  if (!booking) return;

  await opts.prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.PAYMENT_FAILED,
      failureReason:
        pi.last_payment_error?.message ?? pi.last_payment_error?.code ?? null,
    },
  });
}

async function onPaymentIntentCanceled(
  pi: Stripe.PaymentIntent,
  opts: HandleWebhookOptions,
): Promise<void> {
  const booking = await lookupBookingByPaymentIntent(
    pi.id,
    opts,
    "payment_intent.canceled",
  );
  if (!booking) return;

  await opts.prisma.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.CANCELLED_BY_SYSTEM },
  });
}

async function onChargeRefunded(
  charge: Stripe.Charge,
  opts: HandleWebhookOptions,
): Promise<void> {
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  const booking = await lookupBookingByPaymentIntent(
    piId,
    opts,
    "charge.refunded",
  );
  if (!booking) return;

  await opts.prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.REFUNDED,
      refundedAt: new Date(),
      refundAmountCents: charge.amount_refunded,
    },
  });
}

function onDisputeCreated(
  dispute: Stripe.Dispute,
  opts: HandleWebhookOptions,
): void {
  // Disputes do not auto-mutate the booking. The owner reviews the case in the
  // Stripe dashboard and decides whether to refund or contest. Sprint 4 admin
  // panel will surface disputes via the same alert sink.
  opts.onError?.(new Error("charge.dispute.created"), {
    stage: "charge.dispute.created",
    severity: "alert",
    disputeId: dispute.id,
    paymentIntentId:
      typeof dispute.payment_intent === "string"
        ? dispute.payment_intent
        : (dispute.payment_intent?.id ?? null),
    amount: dispute.amount,
    reason: dispute.reason,
  });
}
