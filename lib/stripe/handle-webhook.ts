import type Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";

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
};

export type HandleWebhookOptions = {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
  stripe: StripeWebhookVerifier;
  prisma: WebhookEventStore;
  /** Optional Sentry-shaped sink for observability; tests pass a stub. */
  onError?: (err: unknown, ctx: Record<string, unknown>) => void;
};

/**
 * Pure-ish handler for an inbound Stripe webhook. Extracted from the route
 * file so it's unit-testable with mock Stripe + Prisma.
 *
 * Contract:
 *   1. Reject if secret is missing (returns 500 — wiring bug, not Stripe's fault).
 *   2. Reject if signature header is missing (400).
 *   3. Verify signature via Stripe SDK; reject if invalid (400).
 *   4. Insert event row with skipDuplicates — if 0 inserted, Stripe is retrying
 *      a previously-processed event. Return 200 with duplicate flag.
 *   5. (Sprint 2) route the event to a per-type handler. For F-018 we just
 *      log it. Mark `processedAt` once we're done.
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

  // F-018 ships the skeleton only. Real per-event business logic lands in
  // Sprint 2 (payment_intent.succeeded → confirm booking, etc). For now we
  // just acknowledge so Stripe stops retrying — but mark `processedAt` only
  // after any future per-type handler completes successfully.
  await opts.prisma.webhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() },
  });

  return { status: 200, body: { ok: true } };
}
