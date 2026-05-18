import { describe, expect, test, vi } from "vitest";
import type Stripe from "stripe";

import {
  handleStripeWebhook,
  type StripeWebhookVerifier,
  type WebhookEventStore,
} from "./handle-webhook";

type EventInput = Pick<Stripe.Event, "id" | "type">;

function makeStripe(opts: {
  /** If set, constructEvent returns this event. Otherwise it throws. */
  event?: EventInput;
}): StripeWebhookVerifier {
  const constructEvent: Stripe["webhooks"]["constructEvent"] = (() => {
    if (opts.event) return opts.event as Stripe.Event;
    throw new Error("invalid_signature");
  }) as Stripe["webhooks"]["constructEvent"];
  return { webhooks: { constructEvent: vi.fn(constructEvent) } };
}

function makePrisma(opts: {
  /** Rows already in the table (by id) → createMany returns count=0. */
  existing?: Set<string>;
}) {
  const existing = opts.existing ?? new Set<string>();
  const updates: Array<{ id: string; processedAt: Date | null }> = [];
  const createMany = vi.fn(async (args: { data: Array<{ id: string }> }) => {
    let inserted = 0;
    for (const row of args.data) {
      if (!existing.has(row.id)) {
        existing.add(row.id);
        inserted++;
      }
    }
    return { count: inserted };
  });
  const update = vi.fn(
    async (args: { where: { id: string }; data: { processedAt: Date } }) => {
      updates.push({ id: args.where.id, processedAt: args.data.processedAt });
      return { id: args.where.id };
    },
  );
  const prisma = {
    webhookEvent: { createMany, update },
  } as unknown as WebhookEventStore;
  return { prisma, updates, spies: { createMany, update } };
}

describe("handleStripeWebhook", () => {
  test("returns 500 + captures error when STRIPE_WEBHOOK_SECRET is missing", async () => {
    const onError = vi.fn();
    const { prisma, spies } = makePrisma({});
    const stripe = makeStripe({
      event: { id: "evt_1", type: "payment_intent.succeeded" },
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
    expect(spies.createMany).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  test("returns 400 when stripe-signature header is missing", async () => {
    const { prisma, spies } = makePrisma({});
    const stripe = makeStripe({
      event: { id: "evt_1", type: "payment_intent.succeeded" },
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: null,
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(400);
    expect(spies.createMany).not.toHaveBeenCalled();
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
    expect(spies.createMany).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  test("returns 200 + processes a first-seen event", async () => {
    const { prisma, spies, updates } = makePrisma({});
    const stripe = makeStripe({
      event: { id: "evt_new", type: "payment_intent.succeeded" },
    });

    const out = await handleStripeWebhook({
      rawBody: "{}",
      signature: "t=1,v1=ok",
      secret: "whsec_test",
      stripe,
      prisma,
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({ ok: true });
    expect(spies.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [
        { id: "evt_new", source: "stripe", type: "payment_intent.succeeded" },
      ],
      skipDuplicates: true,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.id).toBe("evt_new");
    expect(updates[0]!.processedAt).toBeInstanceOf(Date);
  });

  test("returns 200 + duplicate flag and skips update when event was already processed", async () => {
    const { prisma, spies, updates } = makePrisma({
      existing: new Set(["evt_dup"]),
    });
    const stripe = makeStripe({
      event: { id: "evt_dup", type: "payment_intent.succeeded" },
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
    expect(spies.createMany).toHaveBeenCalledOnce();
    expect(updates).toHaveLength(0);
  });
});
