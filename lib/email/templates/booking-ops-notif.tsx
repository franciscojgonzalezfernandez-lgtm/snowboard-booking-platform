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

/**
 * F-140: internal "new booking" notification for the instructor + admin. Sent
 * alongside the booker's confirmation email, to the deduped {instructor, admin}
 * recipient set. English-only, like every ops surface. Mirrors the shape of
 * `CancellationOpsNotifEmail` so the two operational emails read as a pair.
 */
export type BookingOpsNotifEmailProps = {
  instructorName: string;
  bookingDateLabel: string;
  anchorTime: string;
  bookingDurationLabel: string;
  attendeeCount: number;
  bookerName: string;
  bookerEmail: string;
  /** E.164 phone the booker gave in the funnel; null for legacy/seed bookers. */
  bookerPhone: string | null;
  totalLabel: string;
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
  totalLabel: string;
  bookerTitle: string;
  bookerNameLabel: string;
  bookerEmailLabel: string;
  bookerPhoneLabel: string;
  signoff: string;
};

const COPY: Copy = {
  subject: ({ date, time }) => `New booking — ${date} ${time}`,
  preview: "A new lesson was booked.",
  heading: "Ride Flumserberg · Ops",
  intro: "A new lesson was booked and paid. The slot is now held.",
  summaryTitle: "Booked slot",
  dateLabel: "Date",
  timeLabel: "Start",
  durationLabel: "Length",
  instructorLabel: "Instructor",
  attendeesLabel: (count) => (count === 1 ? "1 rider" : `${count} riders`),
  totalLabel: "Total",
  bookerTitle: "Booker",
  bookerNameLabel: "Name",
  bookerEmailLabel: "Email",
  bookerPhoneLabel: "Phone",
  signoff: "— automated notification",
};

export function getBookingOpsNotifCopy(): Copy {
  return COPY;
}

export function BookingOpsNotifEmail(props: BookingOpsNotifEmailProps) {
  const {
    instructorName,
    bookingDateLabel,
    anchorTime,
    bookingDurationLabel,
    attendeeCount,
    bookerName,
    bookerEmail,
    bookerPhone,
    totalLabel,
  } = props;
  const t = getBookingOpsNotifCopy();

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
            <Row label={t.totalLabel} value={totalLabel} />
          </Section>

          <Section style={summary}>
            <Text style={summaryTitle}>{t.bookerTitle}</Text>
            <Row label={t.bookerNameLabel} value={bookerName} />
            <Row label={t.bookerEmailLabel} value={bookerEmail} />
            {bookerPhone ? (
              <Row label={t.bookerPhoneLabel} value={bookerPhone} />
            ) : null}
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

const signoff = {
  color: "#5f574f",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "24px 0 0",
};
