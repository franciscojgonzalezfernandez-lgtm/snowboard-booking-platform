"use server";

import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { BookingStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import {
  createBookingDraftWith,
  type CreateDraftDeps,
} from "@/lib/booking/create-draft";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/server";
import { sendBookingConfirmedEmail } from "@/lib/email/send-booking-confirmed";
import type {
  CreateBookingDraftInput,
  CreateBookingDraftResult,
} from "@/lib/schemas/booking-draft";

export type VoidActiveDraftResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "PI_NOT_CANCELABLE"
        | "STRIPE_ERROR"
        | "ALREADY_CANCELLED";
    };

/** Statuses Stripe allows us to cancel from. */
const CANCELABLE_PI_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

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
    // F-060 zero-charge path: a fully-credit-covered booking is created
    // CONFIRMED with no PaymentIntent, so no webhook will send the confirmation.
    // Dispatch it here; failures are logged but never fail the booking.
    dispatchBookingConfirmedEmail: async (bookingId: string) => {
      try {
        await sendBookingConfirmedEmail({ bookingId });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { source: "create-draft-zero-charge-email" },
          extra: { bookingId },
        });
      }
    },
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

/**
 * Server Action: cancel an in-flight PENDING_PAYMENT booking + its Stripe
 * PaymentIntent so the booker can edit Sections 1-3 again. Called from the
 * dirty-edit guard Dialog when the user confirms "Discard payment to edit".
 *
 * Refuses to act if the PaymentIntent is `processing` or `succeeded` —
 * payment is already in motion, so the only safe path is to wait for the
 * webhook (success page on confirmation, refund on failure).
 */
export async function voidActiveDraft(
  bookingId: string,
): Promise<VoidActiveDraftResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookerId: true,
      status: true,
      stripePaymentIntentId: true,
      date: true,
      duration: true,
    },
  });
  if (!booking) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (booking.bookerId !== session.user.id) {
    return { ok: false, error: "FORBIDDEN" };
  }
  if (booking.status === BookingStatus.CANCELLED_BY_USER) {
    return { ok: true };
  }
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    return { ok: false, error: "ALREADY_CANCELLED" };
  }

  if (booking.stripePaymentIntentId) {
    const stripe = getStripe();
    try {
      const pi = await stripe.paymentIntents.retrieve(
        booking.stripePaymentIntentId,
      );
      if (CANCELABLE_PI_STATUSES.has(pi.status)) {
        await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
      } else if (pi.status === "succeeded") {
        // Webhook flips the booking to CONFIRMED — the dirty guard should
        // not have been reachable. Surface a hard error so the UI can
        // redirect to /reservar/exito/[id] instead of looping.
        return { ok: false, error: "PI_NOT_CANCELABLE" };
      } else if (pi.status === "processing") {
        return { ok: false, error: "PI_NOT_CANCELABLE" };
      }
      // Any remaining PI status (canceled) means Stripe already dropped it
      // — fall through to mark the booking row as cancelled too.
    } catch (err) {
      Sentry.captureException(err, {
        tags: { source: "void-active-draft" },
        extra: { bookingId },
      });
      return { ok: false, error: "STRIPE_ERROR" };
    }
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.CANCELLED_BY_USER },
  });

  const dateIso = booking.date.toISOString().slice(0, 10);
  revalidateTag(AVAILABILITY_TAGS.root);
  revalidateTag(AVAILABILITY_TAGS.duration(booking.duration));
  revalidateTag(AVAILABILITY_TAGS.date(dateIso));
  revalidateTag(AVAILABILITY_TAGS.month(dateIso.slice(0, 7)));

  return { ok: true };
}
