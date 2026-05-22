"use server";

import { headers } from "next/headers";
import { revalidateTag } from "next/cache";

import { auth } from "@/lib/auth";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
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
 *
 * Cache: a successful draft locks the slot (PENDING_PAYMENT is treated as
 * hard occupancy by the engine), so we revalidate the availability cache so
 * any other browser session sees the updated calendar/slots immediately.
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
  const result = await createBookingDraftWith(deps, prisma, input);

  if (result.ok && !result.reused) {
    revalidateTag(AVAILABILITY_TAGS.root);
    revalidateTag(AVAILABILITY_TAGS.duration(input.duration));
    revalidateTag(AVAILABILITY_TAGS.date(input.date));
    revalidateTag(AVAILABILITY_TAGS.month(input.date.slice(0, 7)));
  }
  return result;
}
