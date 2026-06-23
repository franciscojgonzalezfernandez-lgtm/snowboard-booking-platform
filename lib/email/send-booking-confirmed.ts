import "server-only";

import React from "react";
import type { CreateEmailOptions } from "resend";
import type { Prisma, PrismaClient } from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { setUtcTime, zurichWallClockToUtc } from "@/lib/booking-engine/time";
import { buildBookingIcs } from "@/lib/ics/build-event";
import { formatChf } from "@/lib/pricing/format";
import { CONTACT_EMAIL } from "@/lib/contact/email";
import type { Db } from "@/lib/db";
import { DURATION_LABELS, INTL_TAG } from "./labels";
import { sendEmail, type EmailClient } from "./send-email";
import {
  BookingConfirmedEmail,
  getBookingConfirmedCopy,
} from "./templates/booking-confirmed";

const ORGANIZER_EMAIL = "booking@rideflumserberg.ch";
const ORGANIZER_NAME = "Ride Flumserberg";
const LOCATION = "Flumserberg, Switzerland";
const APP_BASE_URL = "https://rideflumserberg.ch";

const BOOKING_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  totalPriceCents: true,
  icsUid: true,
  confirmationEmailSentAt: true,
  booker: { select: { name: true, email: true } },
  instructor: { select: { user: { select: { name: true } } } },
  attendees: { select: { id: true } },
} satisfies Prisma.BookingSelect;

export type BookingRowForEmail = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SELECT;
}>;

export type SendBookingConfirmedDeps = {
  prisma: Db;
  send: typeof sendEmail;
  emailClient?: EmailClient;
  now?: Date;
  appBaseUrl?: string;
  contactEmail?: string;
  organizerEmail?: string;
  organizerName?: string;
  location?: string;
};

export type SendBookingConfirmedResult =
  | { ok: true; sent: true; emailId: string }
  | { ok: true; sent: false; reason: "ALREADY_SENT" }
  | { ok: false; error: "BOOKING_NOT_FOUND" };

export async function sendBookingConfirmedEmailWith(
  deps: SendBookingConfirmedDeps,
  bookingId: string,
): Promise<SendBookingConfirmedResult> {
  const now = deps.now ?? new Date();
  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return { ok: false, error: "BOOKING_NOT_FOUND" };

  if (booking.confirmationEmailSentAt) {
    return { ok: true, sent: false, reason: "ALREADY_SENT" };
  }

  const locale = booking.language ?? "en";
  const copy = getBookingConfirmedCopy(locale);
  const bookerName = booking.booker.name ?? booking.booker.email.split("@")[0]!;
  const instructorName =
    booking.instructor.user.name ?? "Ride Flumserberg instructor";
  const durationLabel = DURATION_LABELS[locale][booking.duration];

  const startUtc = setUtcTime(booking.date, booking.anchorTime);
  const minutes = durationMinutes(booking.duration);

  const dateLabel = new Intl.DateTimeFormat(INTL_TAG[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(startUtc);
  const timeLabel = booking.anchorTime;
  const totalLabel = formatChf(booking.totalPriceCents);
  const contactEmail = deps.contactEmail ?? CONTACT_EMAIL;
  const baseUrl = deps.appBaseUrl ?? APP_BASE_URL;
  const manageBookingUrl = `${baseUrl}/${locale}/dashboard`;

  const icsContent = buildBookingIcs({
    uid: booking.icsUid,
    title: `Snowboard lesson · ${instructorName}`,
    // anchorTime is a naive Europe/Zurich wall-clock; convert to the true UTC
    // instant so the .ics DTSTART renders at 12:00 Zurich, not 12:00 UTC. The
    // email body keeps the naive `startUtc` (formatted in UTC) for its label.
    startUtc: zurichWallClockToUtc(startUtc),
    durationMinutes: minutes,
    location: deps.location ?? LOCATION,
    description: `Ride Flumserberg booking. ${copy.summaryTitle}: ${dateLabel} ${timeLabel}.`,
    organizerName: deps.organizerName ?? ORGANIZER_NAME,
    organizerEmail: deps.organizerEmail ?? ORGANIZER_EMAIL,
    attendeeName: bookerName,
    attendeeEmail: booking.booker.email,
  });

  const attachment = {
    filename: "booking.ics",
    content: Buffer.from(icsContent, "utf8").toString("base64"),
    contentType: "text/calendar; method=REQUEST; charset=UTF-8",
  } as unknown as CreateEmailOptions["attachments"] extends Array<infer T>
    ? T
    : never;

  const sent = await deps.send(
    {
      to: booking.booker.email,
      subject: copy.subject(bookerName),
      react: React.createElement(BookingConfirmedEmail, {
        locale,
        bookerName,
        dateLabel,
        timeLabel,
        durationLabel,
        instructorName,
        attendeesCount: booking.attendees.length,
        totalLabel,
        contactEmail,
        manageBookingUrl,
      }),
      text: buildPlainText({
        copy,
        bookerName,
        dateLabel,
        timeLabel,
        durationLabel,
        instructorName,
        attendeesCount: booking.attendees.length,
        totalLabel,
        manageBookingUrl,
        contactEmail,
      }),
      attachments: [attachment],
      tags: [
        { name: "feature", value: "booking" },
        { name: "kind", value: "confirmation" },
        { name: "locale", value: locale },
      ],
    },
    {
      client: deps.emailClient,
      idempotencyKey: `booking-confirmed-${booking.id}`,
    },
  );

  await deps.prisma.booking.update({
    where: { id: booking.id },
    data: { confirmationEmailSentAt: now },
  });

  return { ok: true, sent: true, emailId: sent.id };
}

function buildPlainText(args: {
  copy: ReturnType<typeof getBookingConfirmedCopy>;
  bookerName: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorName: string;
  attendeesCount: number;
  totalLabel: string;
  manageBookingUrl: string;
  contactEmail: string;
}): string {
  const { copy } = args;
  return [
    copy.greeting(args.bookerName),
    copy.body,
    "",
    copy.summaryTitle,
    `${copy.dateLabel}: ${args.dateLabel}`,
    `${copy.timeLabel}: ${args.timeLabel}`,
    `${copy.durationLabel}: ${args.durationLabel}`,
    `${copy.instructorLabel}: ${args.instructorName}`,
    `${copy.attendeesLabel}: ${copy.attendeesValue(args.attendeesCount)}`,
    `${copy.totalLabel}: ${args.totalLabel} (${copy.vatNote})`,
    "",
    copy.calendarNote,
    "",
    `${copy.manageLink}: ${args.manageBookingUrl}`,
    "",
    copy.cancellationNote,
    "",
    `${copy.contactIntro} ${args.contactEmail}.`,
    "",
    copy.signoff,
  ].join("\n");
}

/**
 * Production-ready wrapper. Webhook handler (F-044) passes `bookingId`; this
 * resolves real Prisma + Resend deps and delegates to the pure inner function.
 */
export async function sendBookingConfirmedEmail(input: {
  bookingId: string;
}): Promise<SendBookingConfirmedResult> {
  const { prisma } = await import("@/lib/db");
  return sendBookingConfirmedEmailWith(
    {
      prisma,
      send: sendEmail,
    },
    input.bookingId,
  );
}

// Exported for tests + the wrapper above; also exported for the route handler
// so it can `await import()` a deterministic factory in non-Edge runtimes.
export type { PrismaClient };
