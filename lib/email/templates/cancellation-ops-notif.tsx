import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { Locale } from "@prisma/client";

export type CancellationOpsNotifEmailProps = {
  locale: Locale;
  instructorName: string;
  bookingDateLabel: string;
  bookingDurationLabel: string;
  anchorTime: string;
  bookerName: string;
  bookerEmail: string;
  attendeeCount: number;
  cancellationVariant:
    | "credit"
    | "forfeit"
    | "ops_cash"
    | "ops_credit"
    | "ops_mixed"
    | "ops_no_charge";
};

type Copy = {
  subject: (args: { date: string; time: string }) => string;
  preview: string;
  heading: string;
  intro: string;
  summaryTitle: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorLabel: string;
  attendeesLabel: (count: number) => string;
  bookerTitle: string;
  bookerNameLabel: string;
  bookerEmailLabel: string;
  variantLabel: string;
  variantCredit: string;
  variantForfeit: string;
  variantOpsCash: string;
  variantOpsCredit: string;
  variantOpsMixed: string;
  variantOpsNoCharge: string;
  signoff: string;
};

const COPY: Copy = {
  subject: ({ date, time }) => `Booking cancelled — ${date} ${time}`,
  preview: "A booking was cancelled.",
  heading: "Ride Flumserberg · Ops",
  intro: "A booking was cancelled. The slot is now free.",
  summaryTitle: "Released slot",
  dateLabel: "Date",
  timeLabel: "Start",
  durationLabel: "Length",
  instructorLabel: "Instructor",
  attendeesLabel: (count) => (count === 1 ? "1 rider" : `${count} riders`),
  bookerTitle: "Booker",
  bookerNameLabel: "Name",
  bookerEmailLabel: "Email",
  variantLabel: "Outcome",
  variantCredit: "Booker received credit",
  variantForfeit: "Booker forfeited payment",
  variantOpsCash: "Ops cancel · cash refund issued",
  variantOpsCredit: "Ops cancel · credit re-emitted",
  variantOpsMixed: "Ops cancel · cash refund + credit re-emitted",
  variantOpsNoCharge: "Ops cancel · never paid, slot released",
  signoff: "— automated notification",
};

export function getCancellationOpsNotifCopy(): Copy {
  return COPY;
}

const VARIANT_LABEL: Record<
  CancellationOpsNotifEmailProps["cancellationVariant"],
  (copy: Copy) => string
> = {
  credit: (c) => c.variantCredit,
  forfeit: (c) => c.variantForfeit,
  ops_cash: (c) => c.variantOpsCash,
  ops_credit: (c) => c.variantOpsCredit,
  ops_mixed: (c) => c.variantOpsMixed,
  ops_no_charge: (c) => c.variantOpsNoCharge,
};

export function CancellationOpsNotifEmail(
  props: CancellationOpsNotifEmailProps,
) {
  const {
    instructorName,
    bookingDateLabel,
    bookingDurationLabel,
    anchorTime,
    bookerName,
    bookerEmail,
    attendeeCount,
    cancellationVariant,
  } = props;
  const t = getCancellationOpsNotifCopy();
  const variantLine = VARIANT_LABEL[cancellationVariant](t);

  return (
    <Html lang="en">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>{t.heading}</Heading>
          <Text style={copy}>{t.intro}</Text>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.summaryTitle}</Text>
            <Row label={t.dateLabel} value={bookingDateLabel} />
            <Row label={t.timeLabel} value={anchorTime} />
            <Row label={t.durationLabel} value={bookingDurationLabel} />
            <Row label={t.instructorLabel} value={instructorName} />
            <Row label={t.attendeesLabel(attendeeCount)} value="" />
          </Section>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.bookerTitle}</Text>
            <Row label={t.bookerNameLabel} value={bookerName} />
            <Row label={t.bookerEmailLabel} value={bookerEmail} />
          </Section>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.variantLabel}</Text>
            <Text style={variantBody}>{variantLine}</Text>
          </Section>

          <Text style={signoff}>{t.signoff}</Text>
        </Container>
      </Body>
    </Html>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding="0"
      cellSpacing="0"
      border={0}
      style={row}
    >
      <tbody>
        <tr>
          <td style={rowLabel}>{label}</td>
          <td style={rowValue} align="right">
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const body = {
  backgroundColor: "#f7f5f0",
  color: "#17130f",
  fontFamily:
    "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: "0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #ded8ce",
  margin: "40px auto",
  maxWidth: "560px",
  padding: "40px",
};

const heading = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "24px",
  fontWeight: "400",
  lineHeight: "1.1",
  margin: "0 0 24px",
};

const copy = {
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const summary = {
  backgroundColor: "#f7f5f0",
  border: "1px solid #ded8ce",
  margin: "8px 0 16px",
  padding: "20px 24px",
};

const summaryTitle = {
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.18em",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
};

const row = {
  borderCollapse: "collapse" as const,
  margin: "0 0 4px",
  width: "100%",
};

const rowLabel = {
  color: "#5f574f",
  fontSize: "14px",
  lineHeight: "1.6",
  padding: "0",
};

const rowValue = {
  color: "#17130f",
  fontSize: "14px",
  lineHeight: "1.6",
  padding: "0",
  textAlign: "right" as const,
};

const variantBody = {
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
};

const signoff = {
  color: "#5f574f",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "24px 0 0",
};
