import "server-only";

import React from "react";
import type { Locale, Prisma } from "@prisma/client";

import { formatChf } from "@/lib/pricing/format";
import type { Db } from "@/lib/db";
import { DURATION_LABELS, INTL_TAG } from "./labels";
import { dedupeEmails, OPS_NOTIFICATION_EMAIL } from "./recipients";
import { sendEmail, type EmailClient } from "./send-email";
import {
  BookingOpsNotifEmail,
  getBookingOpsNotifCopy,
} from "./templates/booking-ops-notif";

// Ops/instructor notifications are internal → always English, like every
// operator surface (instructor + admin panels are EN-only).
const OPS_LOCALE: Locale = "en" as Locale;

const BOOKING_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  totalPriceCents: true,
  opsBookingNotifSentAt: true,
  bookerPhone: true,
  booker: { select: { name: true, email: true, phone: true } },
  instructor: { select: { user: { select: { name: true, email: true } } } },
  attendees: { select: { id: true } },
} satisfies Prisma.BookingSelect;

export type BookingRowForOpsNotif = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SELECT;
}>;

export type SendBookingOpsNotifDeps = {
  prisma: Db;
  send: typeof sendEmail;
  emailClient?: EmailClient;
  now?: Date;
  /** Admin recipient override (tests). Defaults to OPS_NOTIFICATION_EMAIL. */
  opsEmail?: string;
};

export type SendBookingOpsNotifResult =
  | { ok: true; sent: true; emailId: string; recipients: string[] }
  | { ok: true; sent: false; reason: "ALREADY_SENT" }
  | { ok: false; error: "BOOKING_NOT_FOUND" };

export async function sendBookingOpsNotifWith(
  deps: SendBookingOpsNotifDeps,
  bookingId: string,
): Promise<SendBookingOpsNotifResult> {
  const now = deps.now ?? new Date();
  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return { ok: false, error: "BOOKING_NOT_FOUND" };

  if (booking.opsBookingNotifSentAt) {
    return { ok: true, sent: false, reason: "ALREADY_SENT" };
  }

  const instructorName =
    booking.instructor.user.name ?? "Ride Flumserberg instructor";
  const bookerName = booking.booker.name ?? booking.booker.email.split("@")[0]!;
  const opsEmail = deps.opsEmail ?? OPS_NOTIFICATION_EMAIL;

  // The single shared notification (F-140): one email to {instructor, admin},
  // deduped so the owner teaching his own lesson gets exactly one — never two.
  const recipients = dedupeEmails([booking.instructor.user.email, opsEmail]);

  const dateLabel = formatDateLabel(booking.date, OPS_LOCALE);
  const durationLabel = DURATION_LABELS[OPS_LOCALE][booking.duration];
  const totalLabel = formatChf(booking.totalPriceCents);
  const copy = getBookingOpsNotifCopy();

  const props = {
    instructorName,
    bookingDateLabel: dateLabel,
    anchorTime: booking.anchorTime,
    bookingDurationLabel: durationLabel,
    attendeeCount: booking.attendees.length,
    bookerName,
    bookerEmail: booking.booker.email,
    // F-140: phone lets the instructor/admin reach the booker directly. Prefer
    // the per-booking snapshot (what they typed in the funnel for THIS booking);
    // fall back to profile User.phone for legacy rows created before the column.
    bookerPhone: booking.bookerPhone ?? booking.booker.phone,
    totalLabel,
  };

  const sent = await deps.send(
    {
      to: recipients,
      subject: copy.subject({ date: dateLabel, time: booking.anchorTime }),
      react: React.createElement(BookingOpsNotifEmail, props),
      text: buildOpsNotifPlainText({ copy, ...props }),
      tags: [
        { name: "feature", value: "booking" },
        { name: "kind", value: "booking-ops-notif" },
        { name: "locale", value: OPS_LOCALE },
      ],
    },
    {
      client: deps.emailClient,
      idempotencyKey: `booking-ops-notif-${booking.id}`,
    },
  );

  await deps.prisma.booking.update({
    where: { id: booking.id },
    data: { opsBookingNotifSentAt: now },
  });

  return { ok: true, sent: true, emailId: sent.id, recipients };
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

function buildOpsNotifPlainText(args: {
  copy: ReturnType<typeof getBookingOpsNotifCopy>;
  instructorName: string;
  bookingDateLabel: string;
  anchorTime: string;
  bookingDurationLabel: string;
  attendeeCount: number;
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string | null;
  totalLabel: string;
}): string {
  const { copy } = args;
  const lines = [
    copy.intro,
    "",
    copy.summaryTitle,
    `${copy.dateLabel}: ${args.bookingDateLabel}`,
    `${copy.timeLabel}: ${args.anchorTime}`,
    `${copy.durationLabel}: ${args.bookingDurationLabel}`,
    `${copy.instructorLabel}: ${args.instructorName}`,
    copy.attendeesLabel(args.attendeeCount),
    `${copy.totalLabel}: ${args.totalLabel}`,
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

/**
 * Production wrapper: resolves real Prisma + Resend deps and delegates. Called
 * best-effort alongside the booker confirmation at both dispatch sites (the
 * Stripe `payment_intent.succeeded` webhook and the zero-charge draft path), so
 * the notif fires for every confirmed booking. Guarded by opsBookingNotifSentAt
 * so a retry never double-sends.
 */
export async function sendBookingOpsNotif(input: {
  bookingId: string;
}): Promise<SendBookingOpsNotifResult> {
  const { prisma } = await import("@/lib/db");
  return sendBookingOpsNotifWith(
    {
      prisma,
      send: sendEmail,
    },
    input.bookingId,
  );
}
