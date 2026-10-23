import "server-only";

import React from "react";
import type { Locale, Prisma } from "@prisma/client";

import type { Db } from "@/lib/db";
import { DURATION_LABELS, INTL_TAG } from "./labels";
import { dedupeEmails, OPS_NOTIFICATION_EMAIL } from "./recipients";
import { sendEmail, type EmailClient } from "./send-email";
import {
  RescheduleOpsNotifEmail,
  getRescheduleOpsNotifCopy,
} from "./templates/reschedule-ops-notif";
import {
  RescheduleUserEmail,
  getRescheduleUserCopy,
} from "./templates/reschedule-user";

const APP_BASE_URL = "https://rideflumserberg.ch";
const OPS_LOCALE: Locale = "en" as Locale;

// After the move, the booking row holds the NEW date/anchorTime; the OLD values
// come in via args (the row no longer carries them).
const BOOKING_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  bookerPhone: true,
  booker: { select: { name: true, email: true, phone: true } },
  instructor: { select: { user: { select: { name: true, email: true } } } },
  attendees: { select: { id: true } },
} satisfies Prisma.BookingSelect;

export type SendRescheduleDeps = {
  prisma: Db;
  send: typeof sendEmail;
  emailClient?: EmailClient;
  appBaseUrl?: string;
  opsEmail?: string;
};

export type RescheduleDispatchArgs = {
  bookingId: string;
  /** The lesson's date BEFORE the move (the row now holds the new date). */
  oldDate: Date;
  oldAnchorTime: string;
};

export type SendRescheduleResult =
  | {
      ok: true;
      booker: { sent: true; emailId: string };
      ops: { sent: true; emailId: string };
    }
  | { ok: false; error: "BOOKING_NOT_FOUND" };

/**
 * F-157 — dispatch the "lesson moved" booker email + the ops/instructor notif.
 *
 * Unlike cancellation, a booking can be moved repeatedly, so there is no single
 * DB sent-at guard: each distinct move is a new notification. Resend
 * idempotency keys (keyed on the NEW slot) still collapse an accidental
 * double-submit of the same move into one send.
 */
export async function sendRescheduleEmailsWith(
  deps: SendRescheduleDeps,
  args: RescheduleDispatchArgs,
): Promise<SendRescheduleResult> {
  const booking = await deps.prisma.booking.findUnique({
    where: { id: args.bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return { ok: false, error: "BOOKING_NOT_FOUND" };

  const locale = booking.language ?? ("en" as Locale);
  const bookerName = booking.booker.name ?? booking.booker.email.split("@")[0]!;
  const instructorName =
    booking.instructor.user.name ?? "Ride Flumserberg instructor";
  const baseUrl = deps.appBaseUrl ?? APP_BASE_URL;
  const opsEmail = deps.opsEmail ?? OPS_NOTIFICATION_EMAIL;

  const newDateIso = booking.date.toISOString().slice(0, 10);

  const bookerOldDateLabel = formatDateLabel(args.oldDate, locale);
  const bookerNewDateLabel = formatDateLabel(booking.date, locale);
  const bookerDurationLabel = DURATION_LABELS[locale][booking.duration];

  const opsOldDateLabel = formatDateLabel(args.oldDate, OPS_LOCALE);
  const opsNewDateLabel = formatDateLabel(booking.date, OPS_LOCALE);
  const opsDurationLabel = DURATION_LABELS[OPS_LOCALE][booking.duration];

  const manageBookingUrl = `${baseUrl}/${locale}/dashboard`;
  const termsUrl = `${baseUrl}/${locale}/terms`;

  // Booker email ---------------------------------------------------------
  const bookerCopy = getRescheduleUserCopy(locale);
  const bookerSent = await deps.send(
    {
      to: booking.booker.email,
      subject: bookerCopy.subject(bookerName),
      react: React.createElement(RescheduleUserEmail, {
        locale,
        bookerName,
        oldDateLabel: bookerOldDateLabel,
        oldAnchorTime: args.oldAnchorTime,
        newDateLabel: bookerNewDateLabel,
        newAnchorTime: booking.anchorTime,
        bookingDurationLabel: bookerDurationLabel,
        instructorName,
        manageBookingUrl,
        termsUrl,
      }),
      text: buildUserPlainText({
        copy: bookerCopy,
        bookerName,
        oldDateLabel: bookerOldDateLabel,
        oldAnchorTime: args.oldAnchorTime,
        newDateLabel: bookerNewDateLabel,
        newAnchorTime: booking.anchorTime,
        bookingDurationLabel: bookerDurationLabel,
        instructorName,
        manageBookingUrl,
        termsUrl,
      }),
      tags: [
        { name: "feature", value: "booking" },
        { name: "kind", value: "reschedule-user" },
        { name: "locale", value: locale },
      ],
    },
    {
      client: deps.emailClient,
      idempotencyKey: `reschedule-${booking.id}-${newDateIso}-${booking.anchorTime}-booker`,
    },
  );

  // Ops / instructor notif (deduped {instructor, admin}, English) --------
  const opsCopy = getRescheduleOpsNotifCopy();
  const opsRecipients = dedupeEmails([booking.instructor.user.email, opsEmail]);
  const opsSent = await deps.send(
    {
      to: opsRecipients,
      subject: opsCopy.subject({
        date: opsNewDateLabel,
        time: booking.anchorTime,
      }),
      react: React.createElement(RescheduleOpsNotifEmail, {
        locale: OPS_LOCALE,
        instructorName,
        oldDateLabel: opsOldDateLabel,
        oldAnchorTime: args.oldAnchorTime,
        newDateLabel: opsNewDateLabel,
        newAnchorTime: booking.anchorTime,
        bookingDurationLabel: opsDurationLabel,
        bookerName,
        bookerEmail: booking.booker.email,
        bookerPhone: booking.bookerPhone ?? booking.booker.phone,
        attendeeCount: booking.attendees.length,
      }),
      text: buildOpsNotifPlainText({
        copy: opsCopy,
        instructorName,
        oldDateLabel: opsOldDateLabel,
        oldAnchorTime: args.oldAnchorTime,
        newDateLabel: opsNewDateLabel,
        newAnchorTime: booking.anchorTime,
        bookingDurationLabel: opsDurationLabel,
        bookerName,
        bookerEmail: booking.booker.email,
        bookerPhone: booking.bookerPhone ?? booking.booker.phone,
        attendeeCount: booking.attendees.length,
      }),
      tags: [
        { name: "feature", value: "booking" },
        { name: "kind", value: "reschedule-ops-notif" },
        { name: "locale", value: OPS_LOCALE },
      ],
    },
    {
      client: deps.emailClient,
      idempotencyKey: `reschedule-${booking.id}-${newDateIso}-${booking.anchorTime}-ops_notif`,
    },
  );

  return {
    ok: true,
    booker: { sent: true, emailId: bookerSent.id },
    ops: { sent: true, emailId: opsSent.id },
  };
}

function formatDateLabel(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildUserPlainText(args: {
  copy: ReturnType<typeof getRescheduleUserCopy>;
  bookerName: string;
  oldDateLabel: string;
  oldAnchorTime: string;
  newDateLabel: string;
  newAnchorTime: string;
  bookingDurationLabel: string;
  instructorName: string;
  manageBookingUrl: string;
  termsUrl: string;
}): string {
  const { copy } = args;
  return [
    copy.greeting(args.bookerName),
    copy.intro,
    "",
    `${copy.fromTitle}: ${args.oldDateLabel} — ${args.oldAnchorTime}`,
    "",
    copy.toTitle,
    `${copy.dateLabel}: ${args.newDateLabel}`,
    `${copy.timeLabel}: ${args.newAnchorTime}`,
    `${copy.durationLabel}: ${args.bookingDurationLabel}`,
    `${copy.instructorLabel}: ${args.instructorName}`,
    "",
    copy.noChargeNote,
    "",
    `${copy.ctaLabel}: ${args.manageBookingUrl}`,
    "",
    `${copy.termsLine} ${args.termsUrl}`,
    "",
    copy.signoff,
  ].join("\n");
}

function buildOpsNotifPlainText(args: {
  copy: ReturnType<typeof getRescheduleOpsNotifCopy>;
  instructorName: string;
  oldDateLabel: string;
  oldAnchorTime: string;
  newDateLabel: string;
  newAnchorTime: string;
  bookingDurationLabel: string;
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string | null;
  attendeeCount: number;
}): string {
  const { copy } = args;
  const lines = [
    copy.intro,
    "",
    `${copy.fromTitle}: ${args.oldDateLabel} — ${args.oldAnchorTime}`,
    "",
    copy.toTitle,
    `${copy.dateLabel}: ${args.newDateLabel}`,
    `${copy.timeLabel}: ${args.newAnchorTime}`,
    `${copy.durationLabel}: ${args.bookingDurationLabel}`,
    `${copy.instructorLabel}: ${args.instructorName}`,
    copy.attendeesLabel(args.attendeeCount),
    "",
    copy.bookerTitle,
    `${copy.bookerNameLabel}: ${args.bookerName}`,
    `${copy.bookerEmailLabel}: ${args.bookerEmail}`,
  ];
  if (args.bookerPhone) {
    lines.push(`${copy.bookerPhoneLabel}: ${args.bookerPhone}`);
  }
  lines.push("", copy.signoff);
  return lines.join("\n");
}

export async function sendRescheduleEmails(
  args: RescheduleDispatchArgs,
): Promise<SendRescheduleResult> {
  const { prisma } = await import("@/lib/db");
  return sendRescheduleEmailsWith({ prisma, send: sendEmail }, args);
}
