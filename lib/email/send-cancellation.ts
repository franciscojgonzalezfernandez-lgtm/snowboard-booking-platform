import React from "react";
import type { Duration, Locale } from "@prisma/client";

import { formatChf } from "@/lib/pricing/format";
import { sendEmail, type EmailClient } from "./send-email";
import {
  CancellationOpsNotifEmail,
  getCancellationOpsNotifCopy,
} from "./templates/cancellation-ops-notif";
import {
  CancellationUserCreditEmail,
  getCancellationUserCreditCopy,
} from "./templates/cancellation-user-credit";
import {
  CancellationUserForfeitEmail,
  getCancellationUserForfeitCopy,
} from "./templates/cancellation-user-forfeit";
import {
  CancellationUserOpsEmail,
  getCancellationUserOpsCopy,
} from "./templates/cancellation-user-ops";

const APP_BASE_URL = "https://rideflumserberg.ch";
const OPS_EMAIL = "franciscojgonzalezfernandez@gmail.com";
const CONTACT_PHONE = "+41 76 638 18 70";
const OPS_LOCALE: Locale = "en" as Locale;

const DURATION_LABELS: Record<Locale, Record<Duration, string>> = {
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

const INTL_TAG: Record<Locale, string> = {
  en: "en-CH",
  de: "de-CH",
  es: "es-CH",
};

export type BookingRowForCancellation = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  cancellationEmailSentAt: Date | null;
  opsCancellationNotifSentAt: Date | null;
  booker: { name: string | null; email: string };
  instructor: { user: { name: string | null } };
  attendees: Array<{ id: string }>;
};

type BookingSelect = {
  id: true;
  date: true;
  anchorTime: true;
  duration: true;
  language: true;
  cancellationEmailSentAt: true;
  opsCancellationNotifSentAt: true;
  booker: { select: { name: true; email: true } };
  instructor: { select: { user: { select: { name: true } } } };
  attendees: { select: { id: true } };
};

const BOOKING_SELECT: BookingSelect = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  cancellationEmailSentAt: true,
  opsCancellationNotifSentAt: true,
  booker: { select: { name: true, email: true } },
  instructor: { select: { user: { select: { name: true } } } },
  attendees: { select: { id: true } },
};

export type SendCancellationDeps = {
  prisma: {
    booking: {
      findUnique(args: {
        where: { id: string };
        select: BookingSelect;
      }): Promise<BookingRowForCancellation | null>;
      update(args: {
        where: { id: string };
        data: {
          cancellationEmailSentAt?: Date;
          opsCancellationNotifSentAt?: Date;
        };
      }): Promise<{ id: string }>;
    };
  };
  send: typeof sendEmail;
  emailClient?: EmailClient;
  now?: Date;
  appBaseUrl?: string;
  opsEmail?: string;
  contactPhone?: string;
};

export type CancellationDispatchArgs =
  | {
      bookingId: string;
      variant: "credit";
      hoursBeforeStart: number;
      creditAmountCents: number;
      creditExpiresAt: Date;
    }
  | {
      bookingId: string;
      variant: "forfeit";
      hoursBeforeStart: number;
    }
  | {
      bookingId: string;
      variant: "ops";
      /** Subtype mirrors the core `CancelBookingByOpsResult.outcome`. Drives
       * which sections render in the booker email + the ops notification
       * variant label. */
      opsOutcome: "cash" | "credit" | "mixed" | "no_charge";
      /** Owner-supplied cancellation reason, surfaced to the booker (F-078).
       * Trimmed/blank reasons collapse to `undefined` and omit the section. */
      opsReason?: string | null;
      cashRefundedCents: number;
      creditReEmittedCents: number;
      /** Anchored on the lesson start (F-078). Only present when a credit
       * was re-emitted; `null` for cash-only and no-charge. */
      creditExpiresAt: Date | null;
    };

export type SendCancellationResult =
  | {
      ok: true;
      booker: { sent: true; emailId: string } | { sent: false; reason: "ALREADY_SENT" };
      ops: { sent: true; emailId: string } | { sent: false; reason: "ALREADY_SENT" };
    }
  | { ok: false; error: "BOOKING_NOT_FOUND" };

export async function sendCancellationEmailsWith(
  deps: SendCancellationDeps,
  args: CancellationDispatchArgs,
): Promise<SendCancellationResult> {
  const now = deps.now ?? new Date();
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
  const opsEmail = deps.opsEmail ?? OPS_EMAIL;
  const contactPhone = deps.contactPhone ?? CONTACT_PHONE;

  const bookerDateLabel = formatDateLabel(booking.date, locale);
  const bookerDurationLabel = DURATION_LABELS[locale][booking.duration];
  const opsDateLabel = formatDateLabel(booking.date, OPS_LOCALE);
  const opsDurationLabel = DURATION_LABELS[OPS_LOCALE][booking.duration];

  const manageBookingUrl = `${baseUrl}/${locale}/dashboard`;
  const termsUrl = `${baseUrl}/${locale}/terms`;

  let bookerResult:
    | { sent: true; emailId: string }
    | { sent: false; reason: "ALREADY_SENT" };
  if (booking.cancellationEmailSentAt) {
    bookerResult = { sent: false, reason: "ALREADY_SENT" };
  } else if (args.variant === "credit") {
    const creditAmountLabel = formatChf(args.creditAmountCents);
    const creditExpiresAtLabel = formatDateLabel(args.creditExpiresAt, locale);
    const copy = getCancellationUserCreditCopy(locale);
    const sent = await deps.send(
      {
        to: booking.booker.email,
        subject: copy.subject(bookerName),
        react: React.createElement(CancellationUserCreditEmail, {
          locale,
          bookerName,
          bookingDateLabel: bookerDateLabel,
          bookingDurationLabel: bookerDurationLabel,
          instructorName,
          creditAmountLabel,
          creditExpiresAtLabel,
          manageBookingUrl,
          termsUrl,
        }),
        text: buildCreditPlainText({
          copy,
          bookerName,
          bookingDateLabel: bookerDateLabel,
          bookingDurationLabel: bookerDurationLabel,
          instructorName,
          creditAmountLabel,
          creditExpiresAtLabel,
          manageBookingUrl,
          termsUrl,
        }),
        tags: [
          { name: "feature", value: "booking" },
          { name: "kind", value: "cancellation-credit" },
          { name: "locale", value: locale },
        ],
      },
      {
        client: deps.emailClient,
        idempotencyKey: `cancel-${booking.id}-credit-booker`,
      },
    );
    bookerResult = { sent: true, emailId: sent.id };
  } else if (args.variant === "forfeit") {
    const copy = getCancellationUserForfeitCopy(locale);
    const sent = await deps.send(
      {
        to: booking.booker.email,
        subject: copy.subject(bookerName),
        react: React.createElement(CancellationUserForfeitEmail, {
          locale,
          bookerName,
          bookingDateLabel: bookerDateLabel,
          bookingDurationLabel: bookerDurationLabel,
          instructorName,
          hoursBeforeStart: args.hoursBeforeStart,
          contactPhone,
          termsUrl,
        }),
        text: buildForfeitPlainText({
          copy,
          bookerName,
          bookingDateLabel: bookerDateLabel,
          bookingDurationLabel: bookerDurationLabel,
          instructorName,
          hoursBeforeStart: args.hoursBeforeStart,
          contactPhone,
          termsUrl,
        }),
        tags: [
          { name: "feature", value: "booking" },
          { name: "kind", value: "cancellation-forfeit" },
          { name: "locale", value: locale },
        ],
      },
      {
        client: deps.emailClient,
        idempotencyKey: `cancel-${booking.id}-forfeit-booker`,
      },
    );
    bookerResult = { sent: true, emailId: sent.id };
  } else {
    // ops-cancel: cash refund / credit re-emit / mixed. Always informational
    // for the booker; no obligation to act. `no_charge` (PENDING_PAYMENT
    // never paid) renders the bare "we cancelled" intro with no money-back
    // sections — still worth telling them the slot is gone.
    const copy = getCancellationUserOpsCopy(locale);
    const reasonLabel = args.opsReason?.trim() ? args.opsReason.trim() : null;
    const cashRefundLabel =
      args.cashRefundedCents > 0 ? formatChf(args.cashRefundedCents) : null;
    const creditAmountLabel =
      args.creditReEmittedCents > 0
        ? formatChf(args.creditReEmittedCents)
        : null;
    const creditExpiresAtLabel =
      args.creditExpiresAt !== null
        ? formatDateLabel(args.creditExpiresAt, locale)
        : null;
    const sent = await deps.send(
      {
        to: booking.booker.email,
        subject: copy.subject(bookerName),
        react: React.createElement(CancellationUserOpsEmail, {
          locale,
          bookerName,
          bookingDateLabel: bookerDateLabel,
          bookingDurationLabel: bookerDurationLabel,
          instructorName,
          reasonLabel,
          cashRefundLabel,
          creditAmountLabel,
          creditExpiresAtLabel,
          manageBookingUrl,
          termsUrl,
        }),
        text: buildOpsPlainText({
          copy,
          bookerName,
          bookingDateLabel: bookerDateLabel,
          bookingDurationLabel: bookerDurationLabel,
          instructorName,
          reasonLabel,
          cashRefundLabel,
          creditAmountLabel,
          creditExpiresAtLabel,
          manageBookingUrl,
          termsUrl,
        }),
        tags: [
          { name: "feature", value: "booking" },
          { name: "kind", value: "cancellation-ops" },
          { name: "locale", value: locale },
        ],
      },
      {
        client: deps.emailClient,
        idempotencyKey: `cancel-${booking.id}-ops-booker`,
      },
    );
    bookerResult = { sent: true, emailId: sent.id };
  }

  let opsResult:
    | { sent: true; emailId: string }
    | { sent: false; reason: "ALREADY_SENT" };
  if (booking.opsCancellationNotifSentAt) {
    opsResult = { sent: false, reason: "ALREADY_SENT" };
  } else {
    const opsCopy = getCancellationOpsNotifCopy();
    const sent = await deps.send(
      {
        to: opsEmail,
        subject: opsCopy.subject({
          date: opsDateLabel,
          time: booking.anchorTime,
        }),
        react: React.createElement(CancellationOpsNotifEmail, {
          locale: OPS_LOCALE,
          instructorName,
          bookingDateLabel: opsDateLabel,
          bookingDurationLabel: opsDurationLabel,
          anchorTime: booking.anchorTime,
          bookerName,
          bookerEmail: booking.booker.email,
          attendeeCount: booking.attendees.length,
          cancellationVariant: opsNotifVariant(args),
        }),
        text: buildOpsNotifPlainText({
          copy: opsCopy,
          instructorName,
          bookingDateLabel: opsDateLabel,
          bookingDurationLabel: opsDurationLabel,
          anchorTime: booking.anchorTime,
          bookerName,
          bookerEmail: booking.booker.email,
          attendeeCount: booking.attendees.length,
          cancellationVariant: opsNotifVariant(args),
        }),
        tags: [
          { name: "feature", value: "booking" },
          { name: "kind", value: "cancellation-ops-notif" },
          { name: "locale", value: OPS_LOCALE },
        ],
      },
      {
        client: deps.emailClient,
        idempotencyKey: `cancel-${booking.id}-ops_notif-ops`,
      },
    );
    opsResult = { sent: true, emailId: sent.id };
  }

  const update: {
    cancellationEmailSentAt?: Date;
    opsCancellationNotifSentAt?: Date;
  } = {};
  if (bookerResult.sent) update.cancellationEmailSentAt = now;
  if (opsResult.sent) update.opsCancellationNotifSentAt = now;
  if (Object.keys(update).length > 0) {
    await deps.prisma.booking.update({
      where: { id: booking.id },
      data: update,
    });
  }

  return { ok: true, booker: bookerResult, ops: opsResult };
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

function buildCreditPlainText(args: {
  copy: ReturnType<typeof getCancellationUserCreditCopy>;
  bookerName: string;
  bookingDateLabel: string;
  bookingDurationLabel: string;
  instructorName: string;
  creditAmountLabel: string;
  creditExpiresAtLabel: string;
  manageBookingUrl: string;
  termsUrl: string;
}): string {
  const { copy } = args;
  return [
    copy.greeting(args.bookerName),
    copy.intro,
    "",
    copy.summaryTitle,
    `${copy.dateLabel}: ${args.bookingDateLabel}`,
    `${copy.durationLabel}: ${args.bookingDurationLabel}`,
    `${copy.instructorLabel}: ${args.instructorName}`,
    "",
    copy.creditHeadline,
    copy.creditBody({
      amount: args.creditAmountLabel,
      expiresAt: args.creditExpiresAtLabel,
    }),
    "",
    `${copy.ctaLabel}: ${args.manageBookingUrl}`,
    "",
    `${copy.termsLine} ${args.termsUrl}`,
    "",
    copy.signoff,
  ].join("\n");
}

function buildForfeitPlainText(args: {
  copy: ReturnType<typeof getCancellationUserForfeitCopy>;
  bookerName: string;
  bookingDateLabel: string;
  bookingDurationLabel: string;
  instructorName: string;
  hoursBeforeStart: number;
  contactPhone: string;
  termsUrl: string;
}): string {
  const { copy } = args;
  return [
    copy.greeting(args.bookerName),
    copy.intro,
    "",
    copy.summaryTitle,
    `${copy.dateLabel}: ${args.bookingDateLabel}`,
    `${copy.durationLabel}: ${args.bookingDurationLabel}`,
    `${copy.instructorLabel}: ${args.instructorName}`,
    "",
    copy.policyHeadline,
    copy.policyBody({ hours: args.hoursBeforeStart }),
    "",
    `${copy.exceptionIntro} ${args.contactPhone}${copy.exceptionTrailer}`,
    "",
    `${copy.termsLine} ${args.termsUrl}`,
    "",
    copy.signoff,
  ].join("\n");
}

function buildOpsPlainText(args: {
  copy: ReturnType<typeof getCancellationUserOpsCopy>;
  bookerName: string;
  bookingDateLabel: string;
  bookingDurationLabel: string;
  instructorName: string;
  reasonLabel: string | null;
  cashRefundLabel: string | null;
  creditAmountLabel: string | null;
  creditExpiresAtLabel: string | null;
  manageBookingUrl: string;
  termsUrl: string;
}): string {
  const { copy } = args;
  const lines: string[] = [
    copy.greeting(args.bookerName),
    copy.intro,
    "",
    copy.summaryTitle,
    `${copy.dateLabel}: ${args.bookingDateLabel}`,
    `${copy.durationLabel}: ${args.bookingDurationLabel}`,
    `${copy.instructorLabel}: ${args.instructorName}`,
  ];
  if (args.reasonLabel) {
    lines.push("", `${copy.reasonHeadline}: ${args.reasonLabel}`);
  }
  if (args.cashRefundLabel) {
    lines.push("", copy.refundHeadline, copy.refundBody(args.cashRefundLabel));
  }
  if (args.creditAmountLabel && args.creditExpiresAtLabel) {
    lines.push(
      "",
      copy.creditHeadline,
      copy.creditBody({
        amount: args.creditAmountLabel,
        expiresAt: args.creditExpiresAtLabel,
      }),
    );
  }
  lines.push(
    "",
    `${copy.ctaLabel}: ${args.manageBookingUrl}`,
    "",
    `${copy.termsLine} ${args.termsUrl}`,
    "",
    copy.signoff,
  );
  return lines.join("\n");
}

type OpsNotifVariant =
  | "credit"
  | "forfeit"
  | "ops_cash"
  | "ops_credit"
  | "ops_mixed"
  | "ops_no_charge";

function opsNotifVariant(args: CancellationDispatchArgs): OpsNotifVariant {
  if (args.variant === "credit" || args.variant === "forfeit") return args.variant;
  return `ops_${args.opsOutcome}` as OpsNotifVariant;
}

function buildOpsNotifPlainText(args: {
  copy: ReturnType<typeof getCancellationOpsNotifCopy>;
  instructorName: string;
  bookingDateLabel: string;
  bookingDurationLabel: string;
  anchorTime: string;
  bookerName: string;
  bookerEmail: string;
  attendeeCount: number;
  cancellationVariant: OpsNotifVariant;
}): string {
  const { copy } = args;
  const variantLine = ((): string => {
    switch (args.cancellationVariant) {
      case "credit":
        return copy.variantCredit;
      case "forfeit":
        return copy.variantForfeit;
      case "ops_cash":
        return copy.variantOpsCash;
      case "ops_credit":
        return copy.variantOpsCredit;
      case "ops_mixed":
        return copy.variantOpsMixed;
      case "ops_no_charge":
        return copy.variantOpsNoCharge;
    }
  })();
  return [
    copy.intro,
    "",
    copy.summaryTitle,
    `${copy.dateLabel}: ${args.bookingDateLabel}`,
    `${copy.timeLabel}: ${args.anchorTime}`,
    `${copy.durationLabel}: ${args.bookingDurationLabel}`,
    `${copy.instructorLabel}: ${args.instructorName}`,
    copy.attendeesLabel(args.attendeeCount),
    "",
    copy.bookerTitle,
    `${copy.bookerNameLabel}: ${args.bookerName}`,
    `${copy.bookerEmailLabel}: ${args.bookerEmail}`,
    "",
    `${copy.variantLabel}: ${variantLine}`,
    "",
    copy.signoff,
  ].join("\n");
}

export async function sendCancellationEmails(
  args: CancellationDispatchArgs,
): Promise<SendCancellationResult> {
  const { prisma } = await import("@/lib/db");
  return sendCancellationEmailsWith(
    {
      prisma: prisma as unknown as SendCancellationDeps["prisma"],
      send: sendEmail,
    },
    args,
  );
}
