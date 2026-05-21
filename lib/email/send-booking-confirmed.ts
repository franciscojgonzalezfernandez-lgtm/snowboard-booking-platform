import React from "react";
import type { CreateEmailOptions } from "resend";
import type { Duration, Locale, PrismaClient } from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { setUtcTime } from "@/lib/booking-engine/time";
import { buildBookingIcs } from "@/lib/ics/build-event";
import { formatChf } from "@/lib/pricing/format";
import { sendEmail, type EmailClient } from "./send-email";
import {
  BookingConfirmedEmail,
  getBookingConfirmedCopy,
} from "./templates/booking-confirmed";
import type { EmailLocale } from "./locale";

const CONTACT_EMAIL = "franciscojgonzalezfernandez@gmail.com";
const ORGANIZER_EMAIL = "booking@rideflumserberg.ch";
const ORGANIZER_NAME = "Ride Flumserberg";
const LOCATION = "Flumserberg, Switzerland";
const APP_BASE_URL = "https://rideflumserberg.ch";

const DURATION_LABEL_KEYS: Record<Duration, string> = {
  ONE_HOUR: "1 hour",
  TWO_HOURS: "2 hours",
  INTENSIVE: "4 hours · intensive",
  FULL_DAY: "6 hours · full day",
};

const DURATION_LABELS: Record<EmailLocale, Record<Duration, string>> = {
  en: {
    ONE_HOUR: "1 hour",
    TWO_HOURS: "2 hours",
    INTENSIVE: "4 hours · intensive",
    FULL_DAY: "6 hours · full day",
  },
  de: {
    ONE_HOUR: "1 Stunde",
    TWO_HOURS: "2 Stunden",
    INTENSIVE: "4 Stunden · Intensiv",
    FULL_DAY: "6 Stunden · Ganztags",
  },
  es: {
    ONE_HOUR: "1 hora",
    TWO_HOURS: "2 horas",
    INTENSIVE: "4 horas · intensivo",
    FULL_DAY: "6 horas · jornada completa",
  },
};

const INTL_TAG: Record<EmailLocale, string> = {
  en: "en-CH",
  de: "de-CH",
  es: "es-CH",
};

void DURATION_LABEL_KEYS;

export type BookingRowForEmail = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  totalPriceCents: number;
  icsUid: string;
  confirmationEmailSentAt: Date | null;
  booker: { name: string | null; email: string };
  instructor: { user: { name: string | null } };
  attendees: Array<{ id: string }>;
};

export type SendBookingConfirmedDeps = {
  prisma: {
    booking: {
      findUnique(args: {
        where: { id: string };
        select: BookingSelect;
      }): Promise<BookingRowForEmail | null>;
      update(args: {
        where: { id: string };
        data: { confirmationEmailSentAt: Date };
      }): Promise<{ id: string }>;
    };
  };
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
} as const;

type BookingSelect = typeof BOOKING_SELECT;

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

  const locale = (booking.language as EmailLocale) ?? "en";
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
    startUtc,
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
    copy.attendeesLabel(args.attendeesCount),
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
      prisma: prisma as unknown as SendBookingConfirmedDeps["prisma"],
      send: sendEmail,
    },
    input.bookingId,
  );
}

// Exported for tests + the wrapper above; also exported for the route handler
// so it can `await import()` a deterministic factory in non-Edge runtimes.
export type { PrismaClient };
