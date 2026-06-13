import "server-only";

import React from "react";
import type { Prisma } from "@prisma/client";

import type { Db } from "@/lib/db";
import { sendEmail, type EmailClient } from "./send-email";
import {
  PostClassEmail,
  getPostClassCopy,
} from "./templates/post-class";

const CONTACT_EMAIL = "franciscojgonzalezfernandez@gmail.com";
const APP_BASE_URL = "https://rideflumserberg.ch";

const BOOKING_SELECT = {
  id: true,
  language: true,
  postClassEmailSentAt: true,
  booker: { select: { name: true, email: true } },
  instructor: { select: { user: { select: { name: true } } } },
} satisfies Prisma.BookingSelect;

export type BookingRowForPostClass = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SELECT;
}>;

export type SendPostClassDeps = {
  prisma: Db;
  send: typeof sendEmail;
  emailClient?: EmailClient;
  now?: Date;
  appBaseUrl?: string;
  contactEmail?: string;
  /** Google Place ID for the review CTA. When null, the CTA is omitted. */
  googlePlaceId?: string | null;
  /** Direct tip URL (e.g. SumUp link). When null, the CTA is omitted. */
  tipUrl?: string | null;
};

export type SendPostClassResult =
  | { ok: true; sent: true; emailId: string }
  | { ok: true; sent: false; reason: "ALREADY_SENT" }
  | { ok: false; error: "BOOKING_NOT_FOUND" };

function buildReviewUrl(placeId: string | null | undefined): string | null {
  if (!placeId) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export async function sendPostClassEmailWith(
  deps: SendPostClassDeps,
  bookingId: string,
): Promise<SendPostClassResult> {
  const now = deps.now ?? new Date();
  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return { ok: false, error: "BOOKING_NOT_FOUND" };

  if (booking.postClassEmailSentAt) {
    return { ok: true, sent: false, reason: "ALREADY_SENT" };
  }

  const locale = booking.language ?? "en";
  const copy = getPostClassCopy(locale);
  const bookerName = booking.booker.name ?? booking.booker.email.split("@")[0]!;
  const instructorName =
    booking.instructor.user.name ?? "Ride Flumserberg instructor";
  const contactEmail = deps.contactEmail ?? CONTACT_EMAIL;
  const baseUrl = deps.appBaseUrl ?? APP_BASE_URL;
  const bookAgainUrl = `${baseUrl}/${locale}/reservar`;
  const reviewUrl = buildReviewUrl(deps.googlePlaceId);
  const tipUrl = deps.tipUrl ?? null;

  const sent = await deps.send(
    {
      to: booking.booker.email,
      subject: copy.subject(instructorName),
      react: React.createElement(PostClassEmail, {
        locale,
        bookerName,
        instructorName,
        reviewUrl,
        tipUrl,
        bookAgainUrl,
        contactEmail,
      }),
      text: buildPlainText({
        copy,
        bookerName,
        instructorName,
        reviewUrl,
        tipUrl,
        bookAgainUrl,
        contactEmail,
      }),
      tags: [
        { name: "feature", value: "booking" },
        { name: "kind", value: "postclass" },
        { name: "locale", value: locale },
      ],
    },
    {
      client: deps.emailClient,
      idempotencyKey: `booking-postclass-${booking.id}`,
    },
  );

  await deps.prisma.booking.update({
    where: { id: booking.id },
    data: { postClassEmailSentAt: now },
  });

  return { ok: true, sent: true, emailId: sent.id };
}

function buildPlainText(args: {
  copy: ReturnType<typeof getPostClassCopy>;
  bookerName: string;
  instructorName: string;
  reviewUrl: string | null;
  tipUrl: string | null;
  bookAgainUrl: string;
  contactEmail: string;
}): string {
  const { copy } = args;
  const lines: string[] = [
    copy.greeting(args.bookerName),
    copy.body(args.instructorName),
    "",
  ];
  if (args.reviewUrl) {
    lines.push(copy.reviewTitle, copy.reviewBody, `${copy.reviewCta}: ${args.reviewUrl}`, "");
  }
  if (args.tipUrl) {
    lines.push(copy.tipTitle, copy.tipBody(args.instructorName), `${copy.tipCta}: ${args.tipUrl}`, "");
  }
  lines.push(`${copy.bookAgainCta}: ${args.bookAgainUrl}`, "");
  lines.push(`${copy.contactIntro} ${args.contactEmail}.`, "", copy.signoff);
  return lines.join("\n");
}

export async function sendPostClassEmail(input: {
  bookingId: string;
  now?: Date;
}): Promise<SendPostClassResult> {
  const { prisma } = await import("@/lib/db");
  return sendPostClassEmailWith(
    {
      prisma,
      send: sendEmail,
      now: input.now,
      googlePlaceId: process.env.GOOGLE_PLACE_ID ?? null,
      tipUrl: process.env.INSTRUCTOR_TIP_URL ?? null,
    },
    input.bookingId,
  );
}
