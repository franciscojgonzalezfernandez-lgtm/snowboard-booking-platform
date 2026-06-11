import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import { getStripe } from "@/lib/stripe/server";
import { handleStripeWebhook } from "@/lib/stripe/handle-webhook";
import { sendBookingConfirmedEmail } from "@/lib/email/send-booking-confirmed";
import { buildCalendarSyncDeps, insertEventWith } from "@/lib/calendar/sync";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = (await headers()).get("stripe-signature");

  const outcome = await handleStripeWebhook({
    rawBody,
    signature,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    stripe: getStripe(),
    prisma,
    onError: (err, ctx) => {
      Sentry.captureException(err, { tags: { source: "stripe-webhook" }, extra: ctx });
    },
    dispatchBookingConfirmedEmail: async (bookingId) => {
      await sendBookingConfirmedEmail({ bookingId });
    },
    syncCalendarOnConfirm: async (bookingId) => {
      // F-075: best-effort Google Calendar insert. The helper swallows its own
      // errors into onError; the handler's try/catch is belt-and-suspenders.
      await insertEventWith(
        buildCalendarSyncDeps(prisma, (err, ctx) => {
          Sentry.captureException(err, { tags: { source: "stripe-webhook" }, extra: ctx });
        }),
        bookingId,
      );
    },
  });

  // Booking status mutations (CONFIRMED / PAYMENT_FAILED / CANCELLED_BY_SYSTEM /
  // REFUNDED) all reshape the availability surface. We don't know from here
  // which event type the handler processed, so revalidate the root tag on any
  // freshly-processed event — duplicates and signature errors skip the flush.
  if (
    outcome.status === 200 &&
    "ok" in outcome.body &&
    !("duplicate" in outcome.body && outcome.body.duplicate)
  ) {
    revalidateTag(AVAILABILITY_TAGS.root);
  }

  return NextResponse.json(outcome.body, { status: outcome.status });
}
