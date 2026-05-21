import { NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";

import { getStripe } from "@/lib/stripe/server";
import { handleStripeWebhook } from "@/lib/stripe/handle-webhook";
import { sendBookingConfirmedEmail } from "@/lib/email/send-booking-confirmed";
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
  });

  return NextResponse.json(outcome.body, { status: outcome.status });
}
