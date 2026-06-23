import "server-only";

import React from "react";
import type { CreateEmailOptions } from "resend";
import type { Prisma } from "@prisma/client";

import type { Db } from "@/lib/db";
import { CONTACT_EMAIL } from "@/lib/contact/email";
import { durationMinutes } from "@/lib/booking-engine/duration";
import { setUtcTime, zurichWallClockToUtc } from "@/lib/booking-engine/time";
import { buildBookingIcs } from "@/lib/ics/build-event";
import { DURATION_LABELS, INTL_TAG } from "./labels";
import { sendEmail, type EmailClient } from "./send-email";
import {
  BookingReminderEmail,
  getBookingReminderCopy,
} from "./templates/booking-reminder";

const CONTACT_PHONE = "+41 76 000 00 00";
const ORGANIZER_EMAIL = "booking@rideflumserberg.ch";
const ORGANIZER_NAME = "Ride Flumserberg";
const LOCATION = "Flumserberg, Switzerland";
const MEETING_POINT = "Tannenbodenalm base station, by the snowboard school flag";
const APP_BASE_URL = "https://rideflumserberg.ch";

const BOOKING_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  icsUid: true,
  reminder24hSentAt: true,
  booker: { select: { name: true, email: true } },
  instructor: { select: { user: { select: { name: true } } } },
} satisfies Prisma.BookingSelect;

export type BookingRowForReminder = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SELECT;
}>;

export type SendBookingReminderDeps = {
  prisma: Db;
  send: typeof sendEmail;
  emailClient?: EmailClient;
  now?: Date;
  appBaseUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  meetingPoint?: string;
  organizerEmail?: string;
  organizerName?: string;
  location?: string;
};

export type SendBookingReminderResult =
  | { ok: true; sent: true; emailId: string }
  | { ok: true; sent: false; reason: "ALREADY_SENT" }
  | { ok: false; error: "BOOKING_NOT_FOUND" };

export async function sendBookingReminderEmailWith(
  deps: SendBookingReminderDeps,
  bookingId: string,
): Promise<SendBookingReminderResult> {
  const now = deps.now ?? new Date();
  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return { ok: false, error: "BOOKING_NOT_FOUND" };

  if (booking.reminder24hSentAt) {
    return { ok: true, sent: false, reason: "ALREADY_SENT" };
  }

  const locale = booking.language ?? "en";
  const copy = getBookingReminderCopy(locale);
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
  const contactEmail = deps.contactEmail ?? CONTACT_EMAIL;
  const contactPhone = deps.contactPhone ?? CONTACT_PHONE;
  const meetingPoint = deps.meetingPoint ?? MEETING_POINT;
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
      react: React.createElement(BookingReminderEmail, {
        locale,
        bookerName,
        dateLabel,
        timeLabel,
        durationLabel,
        instructorName,
        meetingPoint,
        contactEmail,
        contactPhone,
        manageBookingUrl,
      }),
      text: buildPlainText({
        copy,
        bookerName,
        dateLabel,
        timeLabel,
        durationLabel,
        instructorName,
        meetingPoint,
        manageBookingUrl,
        contactEmail,
        contactPhone,
      }),
      attachments: [attachment],
      tags: [
        { name: "feature", value: "booking" },
        { name: "kind", value: "reminder24h" },
        { name: "locale", value: locale },
      ],
    },
    {
      client: deps.emailClient,
      idempotencyKey: `booking-reminder-${booking.id}`,
    },
  );

  await deps.prisma.booking.update({
    where: { id: booking.id },
    data: { reminder24hSentAt: now },
  });

  return { ok: true, sent: true, emailId: sent.id };
}

function buildPlainText(args: {
  copy: ReturnType<typeof getBookingReminderCopy>;
  bookerName: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorName: string;
  meetingPoint: string;
  manageBookingUrl: string;
  contactEmail: string;
  contactPhone: string;
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
    `${copy.meetingLabel}: ${args.meetingPoint}`,
    "",
    copy.bringTitle,
    ...copy.bringList.map((item) => `· ${item}`),
    "",
    copy.calendarNote,
    "",
    `${copy.manageLink}: ${args.manageBookingUrl}`,
    "",
    `${copy.contactIntro} ${args.contactEmail}.`,
    copy.phoneNote(args.contactPhone),
    "",
    copy.signoff,
  ].join("\n");
}

export async function sendBookingReminderEmail(input: {
  bookingId: string;
  now?: Date;
}): Promise<SendBookingReminderResult> {
  const { prisma } = await import("@/lib/db");
  return sendBookingReminderEmailWith(
    {
      prisma,
      send: sendEmail,
      now: input.now,
    },
    input.bookingId,
  );
}
