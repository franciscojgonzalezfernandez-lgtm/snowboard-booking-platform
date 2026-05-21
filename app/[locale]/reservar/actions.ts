"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createBookingDraftWith,
  type CreateDraftDeps,
} from "@/lib/booking/create-draft";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/server";
import type {
  CreateBookingDraftInput,
  CreateBookingDraftResult,
} from "@/lib/schemas/booking-draft";

/**
 * Server Action: create a PENDING_PAYMENT Booking + Stripe PaymentIntent for the
 * input collected by Step 4 (F-041). Step 5 mounts the Payment Element with the
 * returned `clientSecret`. Webhook handler (F-044) flips the booking to
 * CONFIRMED on `payment_intent.succeeded`.
 *
 * Idempotent within a 15-minute window per (bookerId, instructorId, date,
 * anchorTime): refreshing Step 5 reuses the same PaymentIntent.
 */
export async function createBookingDraft(
  input: CreateBookingDraftInput,
): Promise<CreateBookingDraftResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  const deps: CreateDraftDeps = {
    session: session?.user ? { user: { id: session.user.id } } : null,
    prisma: prisma as unknown as CreateDraftDeps["prisma"],
    stripe: getStripe(),
  };
  return createBookingDraftWith(deps, prisma, input);
}
