"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { BookingStatus, type Duration } from "@prisma/client";

import {
  ATTRIBUTION_COOKIE,
  decodeAttribution,
} from "@/lib/attribution/cookie";
import { getSessionUser } from "@/lib/auth/session-user";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import {
  createBookingDraftWith,
  type CreateDraftDeps,
} from "@/lib/booking/create-draft";
import {
  resolveDiscountWith,
  type DiscountError,
} from "@/lib/booking/discount";
import { PriceConfigurationError, resolvePriceCents } from "@/lib/pricing/get-price";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/server";
import { sendBookingConfirmedEmail } from "@/lib/email/send-booking-confirmed";
import { sendBookingOpsNotif } from "@/lib/email/send-booking-ops-notif";
import { sendRescheduleEmails } from "@/lib/email/send-reschedule";
import {
  buildCalendarSyncDeps,
  deleteEventWith,
  insertEventWith,
} from "@/lib/calendar/sync";
import {
  rescheduleBookingWith,
  type RescheduleBookingDeps,
  type RescheduleBookingError,
} from "@/lib/booking/reschedule";
import { rescheduleBookingSchema } from "@/lib/schemas/reschedule";
import type {
  CreateBookingDraftInput,
  CreateBookingDraftResult,
} from "@/lib/schemas/booking-draft";
import type { Empty, Result } from "@/lib/types/result";

export type VoidActiveDraftResult = Result<
  Empty,
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "PI_NOT_CANCELABLE"
  | "STRIPE_ERROR"
  | "ALREADY_CANCELLED"
>;

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
  const user = await getSessionUser();
  // F-156: resolve the first-touch marketing attribution from the cookie. A
  // Server Action is already a dynamic context, so reading cookies here costs
  // nothing in static terms (unlike reading them from a shared layout, F-124).
  const cookieStore = await cookies();
  const attribution = decodeAttribution(
    cookieStore.get(ATTRIBUTION_COOKIE)?.value,
  );
  const deps: CreateDraftDeps = {
    session: user ? { user } : null,
    prisma,
    stripe: getStripe(),
    attribution,
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
      // F-140: instructor + admin notif (single deduped email), same trigger as
      // the booker confirmation. Independent try/catch so it fires even if the
      // booker email above threw, and never fails the booking.
      try {
        await sendBookingOpsNotif({ bookingId });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { source: "create-draft-zero-charge-ops-notif" },
          extra: { bookingId },
        });
      }
    },
    // F-075 zero-charge path: same calendar insert the Stripe webhook runs on
    // the paid path. `insertEventWith` swallows its own failures into onError
    // (best-effort), so this never fails the booking.
    syncCalendarOnConfirm: async (bookingId: string) => {
      await insertEventWith(
        buildCalendarSyncDeps(prisma, (err, ctx) => {
          Sentry.captureException(err, {
            tags: { source: "create-draft-zero-charge-gcal" },
            extra: ctx,
          });
        }),
        bookingId,
      );
    },
  };
  const result = await createBookingDraftWith(deps, prisma, input);

  if (result.ok && !result.reused) {
    revalidateTag(AVAILABILITY_TAGS.root);
    revalidateTag(AVAILABILITY_TAGS.duration(input.duration));
    revalidateTag(AVAILABILITY_TAGS.date(input.date));
    revalidateTag(AVAILABILITY_TAGS.month(input.date.slice(0, 7)));
    // F-156: the attribution is now snapshotted on the booking. Clear the
    // first-touch cookie so a later booking under a different campaign is
    // attributed to that one, not stuck on the original tag.
    if (attribution) cookieStore.delete(ATTRIBUTION_COOKIE);
  }
  return result;
}

export type ValidateDiscountCodeResult =
  | { ok: true; code: string; discountCents: number }
  | {
      ok: false;
      error:
        | DiscountError
        | "UNAUTHORIZED"
        | "NO_ACTIVE_SEASON"
        | "PRICING_MISSING";
    };

/**
 * Server Action (F-155): live preview of a promo code in the step before
 * payment. Validates the code for the signed-in booker and returns the CHF-cents
 * discount against the EFFECTIVE (promo-aware) price of the selected duration,
 * so the funnel summary can show "−CHF X" before the booker pays. Purely a
 * preview — `createBookingDraft` re-validates and re-prices authoritatively
 * (`resolveDiscountWith` is the shared core), so a stale preview can never
 * over-discount the real charge.
 */
export async function validateDiscountCode(input: {
  code: string;
  duration: Duration;
}): Promise<ValidateDiscountCodeResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTHORIZED" };

  const season = await prisma.season.findFirst({
    where: { active: true },
    select: {
      id: true,
      priceCentsByDuration: true,
      promoPriceCentsByDuration: true,
    },
  });
  if (!season) return { ok: false, error: "NO_ACTIVE_SEASON" };

  let totalPriceCents: number;
  try {
    totalPriceCents = resolvePriceCents(season, input.duration).cents;
  } catch (err) {
    if (err instanceof PriceConfigurationError) {
      return { ok: false, error: "PRICING_MISSING" };
    }
    throw err;
  }

  const resolved = await resolveDiscountWith(
    { prisma },
    { codeInput: input.code, userId: user.id, totalPriceCents },
  );
  if (!resolved.ok) return resolved;
  return { ok: true, code: resolved.code.code, discountCents: resolved.discountCents };
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
  const user = await getSessionUser();
  if (!user) {
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
  if (booking.bookerId !== user.id) {
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

export type RescheduleBookingActionResult = Result<
  { newDate: string; newAnchorTime: string },
  RescheduleBookingError | "INVALID_INPUT"
>;

/**
 * Server Action (F-157): a booker moves one of their own CONFIRMED bookings to
 * a new slot, from the reschedule funnel. The pure decision (ownership, the 48h
 * notice window, the one-year horizon, the availability re-check, and the atomic
 * move) lives in `rescheduleBookingWith`. Crucially NO money/credit/discount
 * field is touched — the booker keeps the exact effective price they paid.
 *
 * On success, best-effort AFTER the move (a failure here must not undo a move
 * the booker already confirmed, so each step is logged to Sentry and swallowed):
 *   1. dispatch the "lesson moved" booker email + ops/instructor notif,
 *   2. move the Google Calendar event (delete the old, insert at the new time),
 *   3. bust the availability cache for BOTH the old and the new date — the old
 *      slot is now free and the new slot is now taken.
 */
export async function rescheduleBooking(
  input: unknown,
): Promise<RescheduleBookingActionResult> {
  const parsed = rescheduleBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const user = await getSessionUser();
  const deps: RescheduleBookingDeps = {
    session: user ? { user } : null,
    prisma,
    enginePrisma: prisma,
  };

  const result = await rescheduleBookingWith(deps, parsed.data);
  if (!result.ok) return result;

  const bookingId = parsed.data.bookingId;

  try {
    await sendRescheduleEmails({
      bookingId,
      oldDate: result.oldDate,
      oldAnchorTime: result.oldAnchorTime,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: "reschedule-booking" },
      extra: { bookingId },
    });
  }

  // Move the Google Calendar event: remove the old one (frees googleEventId),
  // then insert at the new time. Both helpers are best-effort and swallow their
  // own failures into onError, so a Google hiccup never fails the move. (If the
  // delete fails the id survives and the insert skips as already_synced, leaving
  // a stale event — logged to Sentry, acceptable for the single-instructor MVP.)
  const calendarDeps = buildCalendarSyncDeps(prisma, (err, ctx) => {
    Sentry.captureException(err, {
      tags: { source: "reschedule-booking" },
      extra: { bookingId, ...ctx },
    });
  });
  await deleteEventWith(calendarDeps, bookingId);
  await insertEventWith(calendarDeps, bookingId);

  const oldIso = result.oldDate.toISOString().slice(0, 10);
  const newIso = result.newDate.toISOString().slice(0, 10);
  revalidateTag(AVAILABILITY_TAGS.root);
  revalidateTag(AVAILABILITY_TAGS.duration(result.duration));
  for (const iso of new Set([oldIso, newIso])) {
    revalidateTag(AVAILABILITY_TAGS.date(iso));
    revalidateTag(AVAILABILITY_TAGS.month(iso.slice(0, 7)));
  }

  return { ok: true, newDate: newIso, newAnchorTime: result.newAnchorTime };
}
