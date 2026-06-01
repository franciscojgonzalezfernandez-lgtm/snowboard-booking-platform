import { BookingStatus, type Duration } from "@prisma/client";
import type Stripe from "stripe";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { setUtcTime } from "@/lib/booking-engine/time";

export const RESUME_WINDOW_MS = 15 * 60 * 1000;

export type ResumePaymentDeps = {
  prisma: {
    booking: {
      findUnique(args: {
        where: { id: string };
        select: {
          id: true;
          bookerId: true;
          instructorId: true;
          status: true;
          totalPriceCents: true;
          chargeAmountCents: true;
          creditsAppliedCents: true;
          stripePaymentIntentId: true;
          createdAt: true;
          date: true;
          anchorTime: true;
          duration: true;
        };
      }): Promise<{
        id: string;
        bookerId: string;
        instructorId: string;
        status: BookingStatus;
        totalPriceCents: number;
        chargeAmountCents: number | null;
        creditsAppliedCents: number | null;
        stripePaymentIntentId: string | null;
        createdAt: Date;
        date: Date;
        anchorTime: string;
        duration: Duration;
      } | null>;
      update(args: {
        where: { id: string };
        data: {
          status?: BookingStatus;
          stripePaymentIntentId?: string;
        };
      }): Promise<{ id: string }>;
    };
  };
  stripe: {
    paymentIntents: {
      retrieve(
        id: string,
      ): Promise<
        Pick<Stripe.PaymentIntent, "id" | "client_secret" | "status">
      >;
      create(
        params: Stripe.PaymentIntentCreateParams,
        options?: Stripe.RequestOptions,
      ): Promise<
        Pick<Stripe.PaymentIntent, "id" | "client_secret" | "status">
      >;
    };
  };
  /** Authenticated booker. Resume must reject any caller who is not the booker. */
  bookerId: string;
  now?: Date;
};

export type ResumePaymentResult =
  | {
      ok: true;
      clientSecret: string;
      bookingId: string;
      /** Full lesson price before credits — for the breakdown line. */
      totalPriceCents: number;
      /** Net amount actually billed via Stripe (price minus applied credits). */
      chargeAmountCents: number;
      /** Credit value applied to this booking (0 when none). */
      creditsAppliedCents: number;
    }
  | { ok: false; error: ResumePaymentError };

export type ResumePaymentError =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "NOT_RESUMABLE"
  | "EXPIRED"
  | "ALREADY_CONFIRMED"
  | "STRIPE_BAD_STATE";

/**
 * Resume the PaymentIntent for a draft booking the booker abandoned mid-checkout.
 *
 * Contract:
 * - Booking must exist, belong to the caller, be `PENDING_PAYMENT` and live
 *   inside the 15-minute idempotency window (matches
 *   `IDEMPOTENCY_WINDOW_MS` in lib/booking/create-draft.ts).
 * - If the linked Stripe PaymentIntent is still in a payable state we return
 *   its current `client_secret` so the Payment Element can re-mount.
 * - If Stripe canceled the PI (timeout, manual cancel, etc.) we silently
 *   create a fresh one with the same amount + metadata and re-point the
 *   booking at it. The booker sees a working Payment Element either way.
 * - If Stripe reports the PI as already succeeded we hand back
 *   ALREADY_CONFIRMED; the caller should redirect the user to the success
 *   page. The webhook is still the source of truth for flipping
 *   `Booking.status` — this branch is the optimistic UX hint.
 * - After the 15-minute window the booking is flipped to PAYMENT_FAILED here
 *   (defensive flip in case the cron has not run yet) and the caller gets
 *   EXPIRED so it can route to /reservar to start fresh.
 */
export async function resumePaymentWith(
  deps: ResumePaymentDeps,
  bookingId: string,
): Promise<ResumePaymentResult> {
  const now = deps.now ?? new Date();

  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookerId: true,
      instructorId: true,
      status: true,
      totalPriceCents: true,
      chargeAmountCents: true,
      creditsAppliedCents: true,
      stripePaymentIntentId: true,
      createdAt: true,
      date: true,
      anchorTime: true,
      duration: true,
    },
  });
  if (!booking) return { ok: false, error: "NOT_FOUND" };
  if (booking.bookerId !== deps.bookerId) return { ok: false, error: "FORBIDDEN" };

  // F-084: the Stripe charge is the net of credits, not the full lesson price.
  // `chargeAmountCents` is persisted at draft creation; fall back to
  // `totalPriceCents` for legacy rows written before this column existed (those
  // predate credit redemption, so charge == price). `creditsAppliedCents`
  // defaults to 0 for the same legacy reason.
  const chargeCents = booking.chargeAmountCents ?? booking.totalPriceCents;
  const creditsAppliedCents = booking.creditsAppliedCents ?? 0;

  if (booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.COMPLETED) {
    return { ok: false, error: "ALREADY_CONFIRMED" };
  }
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    return { ok: false, error: "NOT_RESUMABLE" };
  }

  const ageMs = now.getTime() - booking.createdAt.getTime();
  if (ageMs >= RESUME_WINDOW_MS) {
    // Defensive flip: dashboard already hides this row but the URL is still
    // bookmarkable, so the booker (or a stale tab) could land here after the
    // window closed. Flip the booking so the next dashboard refresh + the
    // cron sweep are consistent.
    await deps.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.PAYMENT_FAILED },
    });
    return { ok: false, error: "EXPIRED" };
  }

  // Reuse the existing PaymentIntent when Stripe says it is still payable.
  if (booking.stripePaymentIntentId) {
    const pi = await deps.stripe.paymentIntents.retrieve(
      booking.stripePaymentIntentId,
    );
    if (pi.status === "succeeded") {
      // Stripe says we got paid — webhook should flip the booking imminently
      // (or already did). Caller routes to the success page.
      return { ok: false, error: "ALREADY_CONFIRMED" };
    }
    if (isPayableStatus(pi.status) && pi.client_secret) {
      return {
        ok: true,
        clientSecret: pi.client_secret,
        bookingId: booking.id,
        totalPriceCents: booking.totalPriceCents,
        chargeAmountCents: chargeCents,
        creditsAppliedCents,
      };
    }
    // Anything else (canceled, requires_capture, processing without secret)
    // falls through to recreate below.
  }

  // Recreate path: brand new PaymentIntent with the same amount + metadata.
  // We use a per-resume idempotency key so retries are safe but do not collide
  // with `booking-${id}` from the original draft creation.
  const startUtc = setUtcTime(booking.date, booking.anchorTime);
  const endUtc = new Date(
    startUtc.getTime() + durationMinutes(booking.duration) * 60_000,
  );

  const fresh = await deps.stripe.paymentIntents.create(
    {
      // F-084: bill the net charge (price minus applied credits), NOT the full
      // lesson price. The credits stay LOCKED to this booking — the webhook
      // settles them to USED on success — so re-billing the full price would
      // double-charge the booker (pay full price AND burn the locked credit).
      amount: chargeCents,
      currency: "chf",
      automatic_payment_methods: { enabled: true, allow_redirects: "always" },
      metadata: {
        bookingId: booking.id,
        bookerId: booking.bookerId,
        instructorId: booking.instructorId,
        startDateTime: startUtc.toISOString(),
        endDateTime: endUtc.toISOString(),
        creditsAppliedCents: String(creditsAppliedCents),
        resumed: "true",
      },
      description: `Snowboard lesson (resume) · ${booking.duration} · ${booking.date.toISOString().slice(0, 10)} ${booking.anchorTime}`,
    },
    {
      idempotencyKey: `booking-${booking.id}-resume-${booking.createdAt.getTime()}`,
    },
  );

  if (!fresh.client_secret) {
    return { ok: false, error: "STRIPE_BAD_STATE" };
  }

  await deps.prisma.booking.update({
    where: { id: booking.id },
    data: { stripePaymentIntentId: fresh.id },
  });

  return {
    ok: true,
    clientSecret: fresh.client_secret,
    bookingId: booking.id,
    totalPriceCents: booking.totalPriceCents,
    chargeAmountCents: chargeCents,
    creditsAppliedCents,
  };
}

function isPayableStatus(status: Stripe.PaymentIntent.Status): boolean {
  return (
    status === "requires_payment_method" ||
    status === "requires_confirmation" ||
    status === "requires_action" ||
    status === "processing"
  );
}
