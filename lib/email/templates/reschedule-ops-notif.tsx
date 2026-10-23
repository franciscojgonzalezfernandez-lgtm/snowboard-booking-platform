import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { Locale } from "@prisma/client";

export type RescheduleOpsNotifEmailProps = {
  locale: Locale;
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
};

type Copy = {
  subject: (args: { date: string; time: string }) => string;
  preview: string;
  intro: string;
  fromTitle: string;
  toTitle: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  instructorLabel: string;
  attendeesLabel: (count: number) => string;
  bookerTitle: string;
  bookerNameLabel: string;
  bookerEmailLabel: string;
  bookerPhoneLabel: string;
  signoff: string;
};

// Ops notifications are English-only (OPS_LOCALE), like the cancellation notif.
const COPY: Copy = {
  subject: ({ date, time }) => `Lesson moved — now ${date} at ${time}`,
  preview: "A booker moved their lesson to a new time.",
  intro: "A booker has moved their lesson. The old slot is now free.",
  fromTitle: "Previous slot",
  toTitle: "New slot",
  dateLabel: "Date",
  timeLabel: "Time",
  durationLabel: "Length",
  instructorLabel: "Instructor",
  attendeesLabel: (count) => `Attendees: ${count}`,
  bookerTitle: "Booker",
  bookerNameLabel: "Name",
  bookerEmailLabel: "Email",
  bookerPhoneLabel: "Phone",
  signoff: "— Ride Flumserberg ops",
};

export function getRescheduleOpsNotifCopy(): Copy {
  return COPY;
}

export function RescheduleOpsNotifEmail({
  locale,
  instructorName,
  oldDateLabel,
  oldAnchorTime,
  newDateLabel,
  newAnchorTime,
  bookingDurationLabel,
  bookerName,
  bookerEmail,
  bookerPhone,
  attendeeCount,
}: RescheduleOpsNotifEmailProps) {
  const t = getRescheduleOpsNotifCopy();

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Ride Flumserberg</Heading>
          <Text style={copy}>{t.intro}</Text>

          <Section style={summaryMuted}>
            <Text style={summaryTitleMuted}>{t.fromTitle}</Text>
            <Row label={t.dateLabel} value={oldDateLabel} />
            <Row label={t.timeLabel} value={oldAnchorTime} />
          </Section>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.toTitle}</Text>
            <Row label={t.dateLabel} value={newDateLabel} />
            <Row label={t.timeLabel} value={newAnchorTime} />
            <Row label={t.durationLabel} value={bookingDurationLabel} />
            <Row label={t.instructorLabel} value={instructorName} />
            <Row label="" value={t.attendeesLabel(attendeeCount)} />
          </Section>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.bookerTitle}</Text>
            <Row label={t.bookerNameLabel} value={bookerName} />
            <Row label={t.bookerEmailLabel} value={bookerEmail} />
            {bookerPhone ? (
              <Row label={t.bookerPhoneLabel} value={bookerPhone} />
            ) : null}
          </Section>

          <Hr style={hr} />
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
  fontSize: "32px",
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
  margin: "16px 0 24px",
  padding: "20px 24px",
};

const summaryMuted = {
  backgroundColor: "#ffffff",
  border: "1px solid #ded8ce",
  margin: "16px 0 8px",
  padding: "16px 24px",
  opacity: 0.75,
};

const summaryTitle = {
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.18em",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
};

const summaryTitleMuted = {
  color: "#5f574f",
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

const hr = {
  borderColor: "#ded8ce",
  margin: "16px 0",
};

const signoff = {
  color: "#5f574f",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "24px 0 0",
};
